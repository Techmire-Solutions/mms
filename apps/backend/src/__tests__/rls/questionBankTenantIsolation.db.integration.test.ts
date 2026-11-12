import pg from "pg";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";
import {
  questionAttachments,
  questionOptions,
  questionTags,
  questions,
  workspaces,
} from "../../db/schema.js";
import { findQuestionById } from "../../db/repositories/questionBankQuestionsRepository.js";
import { requireDatabaseConnection } from "../db-integration/dbTestSupport.js";

/**
 * Tenant isolation for the Question Bank tables.
 *
 * Runs as a NOSUPERUSER NOBYPASSRLS role (the CI `test-backend-rls` job): under `postgres` the
 * policies are inert and the suite would prove nothing. Every repository already filters
 * `workspace_subdomain`; this pins the database-level backstop.
 */

const TENANT_A = "qb-iso-a";
const TENANT_B = "qb-iso-b";
const QUESTION_A = "q-qb-iso-a";
const QUESTION_B = "q-qb-iso-b";

async function assertNonBypassRole(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query<{
      role: string;
      is_superuser: boolean;
      bypass_rls: boolean;
    }>(
      `SELECT current_user AS role, r.rolsuper AS is_superuser, r.rolbypassrls AS bypass_rls
         FROM pg_roles r WHERE r.rolname = current_user`,
    );
    const row = result.rows[0];
    if (!row || row.is_superuser || row.bypass_rls) {
      throw new Error(
        `RLS suite must run as a NOSUPERUSER NOBYPASSRLS role; connected as ${row?.role ?? "unknown"}.`,
      );
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function purge(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    for (const tenant of [TENANT_A, TENANT_B]) {
      await tx.tx
        .delete(questionAttachments)
        .where(eq(questionAttachments.workspaceSubdomain, tenant));
      await tx.tx.delete(questionOptions).where(eq(questionOptions.workspaceSubdomain, tenant));
      await tx.tx.delete(questionTags).where(eq(questionTags.workspaceSubdomain, tenant));
      await tx.tx.delete(questions).where(eq(questions.workspaceSubdomain, tenant));
      await tx.tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

async function seedTenant(tenant: string, questionId: string): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: `ws-${tenant}`, subdomain: tenant, madrasaName: `Isolation ${tenant}` })
      .onConflictDoNothing();
    await tx.insert(questions).values({
      id: questionId,
      workspaceSubdomain: tenant,
      type: "short",
      difficulty: "easy",
      questionLanguage: "en",
      text: `Proprietary question for ${tenant}`,
      answer: `answer for ${tenant}`,
      marks: 2,
      status: "approved",
    });
    await tx.insert(questionOptions).values({
      id: `opt-${tenant}`,
      workspaceSubdomain: tenant,
      questionId,
      optionIndex: 0,
      optionText: "Option A",
    });
    await tx.insert(questionTags).values({ workspaceSubdomain: tenant, questionId, tag: "fiqh" });
    await tx.insert(questionAttachments).values({
      id: `att-${tenant}`,
      workspaceSubdomain: tenant,
      questionId,
      kind: "stem",
      name: "diagram.png",
      mime: "image/png",
      size: 12,
      url: `/uploads/tenants/${tenant}/question-media/diagram.png`,
    });
  });
}

describe("question bank tenant isolation", () => {
  beforeAll(async () => {
    await requireDatabaseConnection();
    await assertNonBypassRole();
    await purge();
    await seedTenant(TENANT_A, QUESTION_A);
    await seedTenant(TENANT_B, QUESTION_B);
  }, 60_000);

  afterAll(async () => {
    await purge();
  }, 60_000);

  it("RLS hides another tenant's questions, options, tags and attachments", async () => {
    const questionRows = await withTenantRead(TENANT_A, (tx) =>
      tx.select({ id: questions.id }).from(questions),
    );
    expect(questionRows.map((r) => r.id)).toEqual([QUESTION_A]);

    const optionRows = await withTenantRead(TENANT_A, (tx) =>
      tx.select({ questionId: questionOptions.questionId }).from(questionOptions),
    );
    expect(optionRows.map((r) => r.questionId)).toEqual([QUESTION_A]);

    const tagRows = await withTenantRead(TENANT_A, (tx) =>
      tx.select({ questionId: questionTags.questionId }).from(questionTags),
    );
    expect(tagRows.map((r) => r.questionId)).toEqual([QUESTION_A]);

    const attachmentRows = await withTenantRead(TENANT_A, (tx) =>
      tx.select({ questionId: questionAttachments.questionId }).from(questionAttachments),
    );
    expect(attachmentRows.map((r) => r.questionId)).toEqual([QUESTION_A]);
  });

  it("a repository lookup cannot cross the tenant boundary", async () => {
    expect(await findQuestionById(TENANT_A, QUESTION_B)).toBeNull();

    const rows = await withTenantRead(TENANT_A, (tx) =>
      tx
        .select({ id: questions.id, answer: questions.answer })
        .from(questions)
        .where(eq(questions.id, QUESTION_B)),
    );
    expect(rows).toEqual([]);
  });

  it("a cross-tenant update or delete affects no rows", async () => {
    const updated = await withTenant(TENANT_A, (tx) =>
      tx
        .update(questions)
        .set({ text: "stolen" })
        .where(and(eq(questions.workspaceSubdomain, TENANT_B), eq(questions.id, QUESTION_B)))
        .returning({ id: questions.id }),
    );
    expect(updated).toEqual([]);

    const deleted = await withTenant(TENANT_A, (tx) =>
      tx.delete(questions).where(eq(questions.id, QUESTION_B)).returning({ id: questions.id }),
    );
    expect(deleted).toEqual([]);
  });

  it("a cross-tenant insert is rejected by the policy", async () => {
    await expect(
      withTenant(TENANT_A, (tx) =>
        tx.insert(questions).values({
          id: "q-forged",
          workspaceSubdomain: TENANT_B,
          type: "short",
          difficulty: "easy",
          questionLanguage: "en",
          text: "forged",
          answer: "forged",
        }),
      ),
    ).rejects.toThrow();
  });
});

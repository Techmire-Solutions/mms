import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { beginLongLivedTenantTransaction, closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  questionAttachments,
  questionCategories,
  questions,
  testBlueprintBuckets,
  testQuestions,
  tests,
  workspaces,
} from "../../db/schema.js";
import { assemblePaperForTest } from "../../db/repositories/questionBankAssemblyPersist.js";
import { findSimilarQuestions } from "../../db/repositories/questionSimilarityRepository.js";
import {
  loadReferencedAttachmentKeys,
  runAttachmentSweep,
} from "../../services/attachmentSweepService.js";
import { extractPgErrorCode, requireDatabaseConnection, uniqueTenant } from "./dbTestSupport.js";

/**
 * Real-Postgres regression suite for the Question Bank specialized subsystems (migration 0242):
 *   - question media rows cascade with the question and enforce the stem/option pairing check;
 *   - the orphan sweep treats a question-media file as referenced (and deletes it once detached);
 *   - deterministic assembly persists links + the blueprint + the seed, and refuses a published paper;
 *   - near-duplicate lookup returns the matching stem.
 */

async function pgCode(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
    return undefined;
  } catch (error) {
    return extractPgErrorCode(error);
  }
}

const TENANT = uniqueTenant("qb-subsystems");
const PAPER = `${TENANT}-paper`;
let uploadRoot = "";

async function seedFixtures(): Promise<void> {
  const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await tx.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Subsystems" })
      .onConflictDoNothing();
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

async function resetQuestions(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(questionAttachments).where(eq(questionAttachments.workspaceSubdomain, TENANT));
    await tx.delete(testQuestions).where(eq(testQuestions.workspaceSubdomain, TENANT));
    await tx
      .delete(testBlueprintBuckets)
      .where(eq(testBlueprintBuckets.workspaceSubdomain, TENANT));
    await tx.delete(tests).where(eq(tests.workspaceSubdomain, TENANT));
    await tx.delete(questionCategories).where(eq(questionCategories.workspaceSubdomain, TENANT));
    await tx.delete(questions).where(eq(questions.workspaceSubdomain, TENANT));

    await tx.insert(tests).values({
      id: PAPER,
      workspaceSubdomain: TENANT,
      name: "Assembled Paper",
      duration: 60,
    });

    // Six approved candidates: two per difficulty, all in the same topic.
    const rows = ["easy", "easy", "medium", "medium", "hard", "hard"].map((difficulty, index) => ({
      id: `${TENANT}-q${index}`,
      workspaceSubdomain: TENANT,
      type: "mcq",
      difficulty,
      questionLanguage: "en",
      text: `Question number ${index} about the topic`,
      answer: "a",
      marks: 2,
      status: "approved",
    }));
    await tx.insert(questions).values(rows);
    await tx.insert(questionCategories).values(
      rows.map((row) => ({
        workspaceSubdomain: TENANT,
        questionId: row.id,
        categoryId: "fiqh",
      })),
    );
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await seedFixtures();
  uploadRoot = await mkdtemp(join(tmpdir(), "qb-subsystems-"));
}, 120_000);

beforeEach(async () => {
  await resetQuestions();
});

afterAll(async () => {
  await rm(uploadRoot, { recursive: true, force: true }).catch(() => undefined);
  const cleanup = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
  try {
    await cleanup.tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await cleanup.tx
      .delete(questionAttachments)
      .where(eq(questionAttachments.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(testQuestions).where(eq(testQuestions.workspaceSubdomain, TENANT));
    await cleanup.tx
      .delete(testBlueprintBuckets)
      .where(eq(testBlueprintBuckets.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(tests).where(eq(tests.workspaceSubdomain, TENANT));
    await cleanup.tx
      .delete(questionCategories)
      .where(eq(questionCategories.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(questions).where(eq(questions.workspaceSubdomain, TENANT));
    await cleanup.tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
    await cleanup.commit();
  } catch {
    await cleanup.rollback().catch(() => undefined);
  }
  await closeDatabase();
});

describe("question media attachments (real Postgres)", () => {
  it("cascades with the question and enforces the stem/option pairing", async () => {
    const questionId = `${TENANT}-q0`;
    await withTenant(TENANT, (tx) =>
      tx.insert(questionAttachments).values({
        id: "att-1",
        workspaceSubdomain: TENANT,
        questionId,
        kind: "stem",
        name: "diagram.webp",
        mime: "image/webp",
        size: 10,
        url: `/uploads/tenants/${TENANT}/question-media/diagram.webp`,
      }),
    );

    // `kind = 'option'` requires an option index.
    expect(
      await pgCode(() =>
        withTenant(TENANT, (tx) =>
          tx.insert(questionAttachments).values({
            id: "att-bad",
            workspaceSubdomain: TENANT,
            questionId,
            kind: "option",
            name: "bad.webp",
            mime: "image/webp",
            size: 10,
            url: `/uploads/tenants/${TENANT}/question-media/bad.webp`,
          }),
        ),
      ),
    ).toBe("23514");

    // Purging the question removes its attachment rows.
    await withTenant(TENANT, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx.delete(questions).where(eq(questions.id, questionId));
    });
    const remaining = await withTenant(TENANT, (tx) =>
      tx
        .select({ id: questionAttachments.id })
        .from(questionAttachments)
        .where(eq(questionAttachments.questionId, questionId)),
    );
    expect(remaining).toHaveLength(0);
  });

  it("treats a referenced question-media file as non-orphaned, then sweeps it once detached", async () => {
    const dir = join(uploadRoot, "tenants", TENANT, "question-media");
    await mkdir(dir, { recursive: true });
    const file = join(dir, "kept.webp");
    await writeFile(file, "x");
    const url = `/uploads/tenants/${TENANT}/question-media/kept.webp`;

    await withTenant(TENANT, (tx) =>
      tx.insert(questionAttachments).values({
        id: "att-kept",
        workspaceSubdomain: TENANT,
        questionId: `${TENANT}-q0`,
        kind: "stem",
        name: "kept.webp",
        mime: "image/webp",
        size: 1,
        url,
      }),
    );

    const referenced = await loadReferencedAttachmentKeys();
    expect(referenced.has(`${TENANT}/question-media/kept.webp`)).toBe(true);

    const keptRun = await runAttachmentSweep({ apply: true, root: uploadRoot, minAgeMs: 0 });
    expect(keptRun.deleted).toBe(0);
    expect(keptRun.orphanFiles).toHaveLength(0);

    // Detach → the file is no longer referenced and the next sweep removes it.
    await withTenant(TENANT, (tx) =>
      tx.delete(questionAttachments).where(eq(questionAttachments.id, "att-kept")),
    );
    const sweepRun = await runAttachmentSweep({ apply: true, root: uploadRoot, minAgeMs: 0 });
    expect(sweepRun.deleted).toBe(1);
  });
});

describe("deterministic blueprint assembly (real Postgres)", () => {
  it("persists the selection, blueprint and seed", async () => {
    const outcome = await assemblePaperForTest(TENANT, {
      testId: PAPER,
      blueprint: {
        excludeRecentlyUsedDays: 0,
        totalMarks: 20,
        buckets: [
          { difficulty: "easy", count: 2 },
          { difficulty: "hard", count: 1 },
        ],
      },
    });

    expect(outcome.questionIds).toHaveLength(3);
    expect(outcome.result.totalMarks).toBe(6);

    const links = await withTenant(TENANT, (tx) =>
      tx
        .select({ questionId: testQuestions.questionId })
        .from(testQuestions)
        .where(and(eq(testQuestions.workspaceSubdomain, TENANT), eq(testQuestions.testId, PAPER))),
    );
    expect(links).toHaveLength(3);

    const [paper] = await withTenant(TENANT, (tx) =>
      tx.select({ assemblySeed: tests.assemblySeed }).from(tests).where(eq(tests.id, PAPER)),
    );
    expect(paper?.assemblySeed).toBe(PAPER);

    const buckets = await withTenant(TENANT, (tx) =>
      tx
        .select({ bucketIndex: testBlueprintBuckets.bucketIndex })
        .from(testBlueprintBuckets)
        .where(eq(testBlueprintBuckets.testId, PAPER)),
    );
    expect(buckets).toHaveLength(2);

    // Same seed + same candidates ⇒ the same selection.
    const again = await assemblePaperForTest(TENANT, {
      testId: PAPER,
      blueprint: {
        excludeRecentlyUsedDays: 0,
        totalMarks: 20,
        buckets: [
          { difficulty: "easy", count: 2 },
          { difficulty: "hard", count: 1 },
        ],
      },
    });
    expect(again.questionIds).toEqual(outcome.questionIds);
  });

  it("refuses to assemble a published paper", async () => {
    await withTenant(TENANT, (tx) =>
      tx
        .update(tests)
        .set({ publishedAt: new Date(), publishedBy: "u-1" })
        .where(eq(tests.id, PAPER)),
    );

    await expect(
      assemblePaperForTest(TENANT, {
        testId: PAPER,
        blueprint: { excludeRecentlyUsedDays: 0, buckets: [{ count: 2 }] },
      }),
    ).rejects.toMatchObject({ statusCode: 409, type: "paper_locked" });
  });
});

describe("duplicate detection (real Postgres)", () => {
  it("ranks a near-identical stem above the threshold", async () => {
    const reference = "Explain the significance of the event of Ghadir Khumm in Islamic history.";
    await withTenant(TENANT, (tx) =>
      tx
        .update(questions)
        .set({ text: reference })
        .where(eq(questions.id, `${TENANT}-q0`)),
    );

    const matches = await findSimilarQuestions(TENANT, {
      text: "Explain the significance of the event of Ghadir Khumm in Islam history.",
      limit: 5,
    });

    expect(matches.some((match) => match.id === `${TENANT}-q0`)).toBe(true);
    expect(matches[0]?.score).toBeGreaterThanOrEqual(0.65);
  });
});

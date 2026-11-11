import pg from "pg";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase, beginLongLivedTenantTransaction } from "../../db/dbConnection.js";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";
import {
  enrollments,
  examClasses,
  examEligibilityOverrides,
  examResults,
  exams,
  sessionClasses,
  sessions,
  students,
  workspaces,
} from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { listExamResultsPage } from "../../db/repositories/examinationResultsRepository.js";
import {
  grantEligibilityOverride,
  loadExamEligibilityBatch,
} from "../../db/repositories/examEligibilityRepository.js";
import { listExamsByWorkspace } from "../../db/repositories/examinationExamsRepository.js";
import { loadExaminationsReportAggregatesSql } from "../../db/repositories/examinationRepositoryReport.js";
import { requireDatabaseConnection } from "../db-integration/dbTestSupport.js";

/**
 * Tenant isolation for the examination tables.
 *
 * Defence in depth: every repository filters `workspace_subdomain`, and FORCE RLS backs that up at
 * the database. This suite runs as a NOSUPERUSER NOBYPASSRLS role (the CI `test-backend-rls` job) so
 * it proves isolation even for a query that carries no WHERE clause — running it under `postgres`
 * (superuser / bypass RLS) would prove nothing.
 */

const TENANT_A = "exam-iso-a";
const TENANT_B = "exam-iso-b";
const CLASS_A = "cls-exam-iso-a";
const CLASS_B = "cls-exam-iso-b";
const STUDENT_A = "stu-exam-iso-a";
const STUDENT_B = "stu-exam-iso-b";

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
        .delete(examEligibilityOverrides)
        .where(eq(examEligibilityOverrides.workspaceSubdomain, tenant));
      await tx.tx.delete(examResults).where(eq(examResults.workspaceSubdomain, tenant));
      await tx.tx.delete(examClasses).where(eq(examClasses.workspaceSubdomain, tenant));
      await tx.tx.delete(exams).where(eq(exams.workspaceSubdomain, tenant));
      await tx.tx.delete(enrollments).where(eq(enrollments.workspaceSubdomain, tenant));
      await tx.tx.delete(sessionClasses).where(eq(sessionClasses.workspaceSubdomain, tenant));
      await tx.tx.delete(sessions).where(eq(sessions.workspaceSubdomain, tenant));
      await tx.tx.delete(students).where(eq(students.workspaceSubdomain, tenant));
      await tx.tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}

async function seedTenant(tenant: string, classId: string, studentId: string): Promise<void> {
  const sessionId = `ses-${tenant}`;
  const examId = `ex-${tenant}`;
  await withTenant(
    tenant,
    async (tx) => {
      await tx
        .insert(workspaces)
        .values({ id: `ws-${tenant}`, subdomain: tenant, madrasaName: `Isolation ${tenant}` })
        .onConflictDoNothing();
      await tx.insert(students).values({
        id: studentId,
        workspaceSubdomain: tenant,
        grNumber: `gr-${studentId}`,
        status: "active",
      });
      await tx
        .insert(sessions)
        .values({ id: sessionId, workspaceSubdomain: tenant, name: `Session ${tenant}` });
      await tx
        .insert(sessionClasses)
        .values({ id: classId, workspaceSubdomain: tenant, sessionId, name: `Class ${tenant}` });
      await tx.insert(enrollments).values({
        id: `enr-${tenant}`,
        workspaceSubdomain: tenant,
        studentId,
        studentName: studentId,
        sessionId,
        sessionName: `Session ${tenant}`,
        classId,
        className: `Class ${tenant}`,
        enrolledDate: "2026-01-01",
        startOn: "2026-01-01",
        status: "confirmed",
      });
      await tx.insert(exams).values({
        id: examId,
        workspaceSubdomain: tenant,
        name: `Exam ${tenant}`,
        totalMarks: 100,
        passingMarks: 50,
        date: "2026-03-10",
        duration: 60,
        status: "ongoing",
      });
      await tx.insert(examClasses).values({ workspaceSubdomain: tenant, examId, classId });
      await tx.insert(examResults).values({
        id: `er-${tenant}`,
        workspaceSubdomain: tenant,
        examId,
        studentId,
        marksObtained: 75,
        markedBy: `u-${tenant}`,
      });
      await tx.insert(examEligibilityOverrides).values({
        workspaceSubdomain: tenant,
        examId,
        studentId,
        reason: "Medical leave",
        grantedBy: `u-${tenant}`,
      });
    },
    { readOnly: false },
  );
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await assertNonBypassRole();
  await purge();
  await seedTenant(TENANT_A, CLASS_A, STUDENT_A);
  await seedTenant(TENANT_B, CLASS_B, STUDENT_B);
}, 120_000);

afterAll(async () => {
  await purge();
  await closeDatabase();
});

describe("examinations tenant isolation", () => {
  it("every examination tenant table enforces FORCE row level security", async () => {
    const tx = await beginLongLivedTenantTransaction(null, { allowGlobal: true });
    try {
      const rows = await tx.tx.execute<{ relname: string; rls: boolean; forced: boolean }>(sql`
        SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname IN (
             'exams', 'exam_classes', 'exam_results', 'exam_eligibility_overrides',
             'examinations_field_configs', 'examinations_module_preferences',
             'tests', 'test_sections', 'test_questions', 'test_section_questions',
             'question_bank_field_configs', 'question_bank_module_preferences'
           )
      `);
      const byName = new Map((rows.rows ?? []).map((row) => [row.relname, row]));
      for (const table of [
        "exams",
        "exam_classes",
        "exam_results",
        "exam_eligibility_overrides",
        "examinations_field_configs",
        "examinations_module_preferences",
        "tests",
        "test_sections",
        "test_questions",
        "test_section_questions",
        "question_bank_field_configs",
        "question_bank_module_preferences",
      ]) {
        const entry = byName.get(table);
        expect(entry, `${table} missing`).toBeDefined();
        expect(entry?.rls, `${table} RLS not enabled`).toBe(true);
        expect(entry?.forced, `${table} RLS not forced`).toBe(true);
      }
    } finally {
      await tx.commit();
    }
  });

  it("report analytics aggregate only the calling tenant's marks", async () => {
    // The analytics path joins exam_results ⋈ exams ⋈ subjects; under RLS (and its explicit
    // tenant predicate) tenant A must never see tenant B's 75 mark.
    const analyticsA = await loadExaminationsReportAggregatesSql(TENANT_A);
    const analyticsB = await loadExaminationsReportAggregatesSql(TENANT_B);

    expect(analyticsA.analytics?.subjectPassRates).toEqual([
      expect.objectContaining({ total: 1, passed: 1 }),
    ]);
    expect(analyticsB.analytics?.subjectPassRates).toEqual([
      expect.objectContaining({ total: 1, passed: 1 }),
    ]);
    expect(analyticsA.analytics?.topPerformers.map((row) => row.studentId)).toEqual([STUDENT_A]);
    expect(analyticsB.analytics?.topPerformers.map((row) => row.studentId)).toEqual([STUDENT_B]);
  });

  it("unfiltered reads return only the tenant's own rows", async () => {
    const [ownExams, ownResults, ownOverrides] = await Promise.all([
      withTenantRead(TENANT_A, (tx) => tx.select().from(exams)),
      withTenantRead(TENANT_A, (tx) => tx.select().from(examResults)),
      withTenantRead(TENANT_A, (tx) => tx.select().from(examEligibilityOverrides)),
    ]);
    expect(ownExams.map((row) => row.workspaceSubdomain)).toEqual([TENANT_A]);
    expect(ownResults.map((row) => row.workspaceSubdomain)).toEqual([TENANT_A]);
    expect(ownOverrides.map((row) => row.workspaceSubdomain)).toEqual([TENANT_A]);
  });

  it("repository reads never cross tenants, even when asked for another tenant's exam", async () => {
    const page = await listExamResultsPage(TENANT_A, { examId: `ex-${TENANT_B}` });
    expect(page.results).toEqual([]);

    const eligibility = await loadExamEligibilityBatch(TENANT_A, [`ex-${TENANT_B}`]);
    expect(eligibility.get(`ex-${TENANT_B}`)?.rows ?? []).toEqual([]);

    const examList = await listExamsByWorkspace(TENANT_A);
    expect(examList.every((exam) => exam.id === `ex-${TENANT_A}`)).toBe(true);
  });

  it("cross-tenant updates and deletes affect zero rows", async () => {
    const updated = await withTenant(TENANT_A, (tx) =>
      tx
        .update(examResults)
        .set({ marksObtained: 1 })
        .where(eq(examResults.workspaceSubdomain, TENANT_B))
        .returning({ id: examResults.id }),
    );
    expect(updated).toEqual([]);

    const deleted = await withTenant(TENANT_A, (tx) =>
      tx
        .delete(examResults)
        .where(
          and(eq(examResults.workspaceSubdomain, TENANT_B), eq(examResults.id, `er-${TENANT_B}`)),
        )
        .returning({ id: examResults.id }),
    );
    expect(deleted).toEqual([]);
  });

  it("cross-tenant eligibility overrides cannot be read, updated or granted", async () => {
    const overrides = await withTenantRead(TENANT_A, (tx) =>
      tx
        .select()
        .from(examEligibilityOverrides)
        .where(eq(examEligibilityOverrides.workspaceSubdomain, TENANT_B)),
    );
    expect(overrides).toEqual([]);

    const updated = await withTenant(TENANT_A, (tx) =>
      tx
        .update(examEligibilityOverrides)
        .set({ reason: "cross-tenant" })
        .where(eq(examEligibilityOverrides.workspaceSubdomain, TENANT_B))
        .returning({ id: examEligibilityOverrides.studentId }),
    );
    expect(updated).toEqual([]);

    await expect(
      grantEligibilityOverride(TENANT_A, {
        examId: `ex-${TENANT_B}`,
        studentId: STUDENT_A,
        reason: "cross-tenant grant",
        grantedBy: "u-iso",
      }),
    ).rejects.toBeTruthy();
  });

  it("a cross-tenant mark cannot be inserted (composite tenant FK)", async () => {
    await expect(
      withTenant(TENANT_A, (tx) =>
        tx.insert(examResults).values({
          id: "er-cross-tenant",
          workspaceSubdomain: TENANT_A,
          examId: `ex-${TENANT_B}`,
          studentId: STUDENT_A,
          marksObtained: 10,
        }),
      ),
    ).rejects.toBeTruthy();
  });

  it("the audit chain refuses a cross-tenant append", async () => {
    const { recordModernAuditEvent } = await import("../../services/auditTrailService.js");
    await expect(
      // The request context must say TENANT_A for the service's cross-tenant guard to be the
      // thing that fires (otherwise only the RLS policy would reject the insert).
      runWithTenant(TENANT_A, () =>
        withTenant(TENANT_A, (tx) =>
          recordModernAuditEvent(tx, {
            workspaceSubdomain: TENANT_B,
            tableName: "exam_results",
            recordId: "er-cross",
            actionType: "UPDATE",
            newState: { marksObtained: 100 },
          }),
        ),
      ),
    ).rejects.toThrow(/refusing to append/);
  });
});

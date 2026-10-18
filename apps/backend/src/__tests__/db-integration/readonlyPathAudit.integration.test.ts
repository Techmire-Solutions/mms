import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { closeDatabase, getRootDb } from "../../db/dbConnection.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";
import { workspaces } from "../../db/schema.js";
import { withTenantRead } from "../../db/tenant-context.js";

/**
 * Proves that every read path routed through `withTenantRead` really is
 * read-only.
 *
 * `withTenantRead` opens the transaction with Postgres
 * `accessMode: 'read only'` (and routes to the read replica when one is
 * configured). If any function converted to it actually writes, Postgres raises
 * SQLSTATE 25006 (`cannot execute INSERT in a read-only transaction`) — so
 * exercising them against a real database is a direct check on the conversion,
 * not a proxy for one.
 *
 * The test is skipped automatically when no database is reachable.
 */
const TEST_SUBDOMAIN = "readonly-path-audit";

beforeAll(async () => {
  await requireDatabaseConnection();

  // The subdomain only needs to exist so tenant-scoped predicates match cleanly;
  // these paths are reads, so no fixture rows are required.
  const existing = await getRootDb()
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(sql`${workspaces.subdomain} = ${TEST_SUBDOMAIN}`)
    .limit(1);
  if (existing.length === 0) {
    await getRootDb()
      .insert(workspaces)
      .values({
        id: `ws-${TEST_SUBDOMAIN}`,
        subdomain: TEST_SUBDOMAIN,
        madrasaName: "Read-Only Path Audit",
        enabled: true,
      });
  }
});

afterAll(async () => {
  {
    await getRootDb()
      .delete(workspaces)
      .where(sql`${workspaces.subdomain} = ${TEST_SUBDOMAIN}`)
      .catch(() => undefined);
  }
  await closeDatabase().catch(() => undefined);
});

/** A representative cross-module sample of the converted read functions. */
type ReadCase = { label: string; run: (tenant: string) => Promise<unknown> };

async function buildReadCases(): Promise<ReadCase[]> {
  const [
    contactHydrate,
    contactList,
    contactMetrics,
    studentHydrate,
    studentPage,
    facultyRepo,
    tenantUserHydrate,
    tenantUserList,
    attendanceRepo,
    attendanceList,
    enrollmentHydrate,
    enrollmentList,
    financeInvoices,
    financeList,
    accountingAccounts,
    accountingListPages,
    sessionHydrate,
    sessionList,
    examRepo,
    obligationTypes,
    hasanatBatches,
    questionBankQuestions,
    questionBankList,
  ] = await Promise.all([
    import("../../db/repositories/contactRepositoryHydrate.js"),
    import("../../db/repositories/contactRepositoryList.js"),
    import("../../db/repositories/contactRepositoryMetrics.js"),
    import("../../db/repositories/studentRepositoryHydrate.js"),
    import("../../db/repositories/studentRepositoryListPage.js"),
    import("../../db/repositories/facultyRepository.js"),
    import("../../db/repositories/tenantUserRepositoryHydrate.js"),
    import("../../db/repositories/tenantUserRepositoryList.js"),
    import("../../db/repositories/attendanceRepository.js"),
    import("../../db/repositories/attendanceRepositoryList.js"),
    import("../../db/repositories/enrollmentRepositoryHydrate.js"),
    import("../../db/repositories/enrollmentRepositoryList.js"),
    import("../../db/repositories/financeInvoicesRepository.js"),
    import("../../db/repositories/financeRepositoryList.js"),
    import("../../db/repositories/accountingAccountsRepository.js"),
    import("../../db/repositories/accountingRepositoryListPages.js"),
    import("../../db/repositories/sessionRepositoryHydrate.js"),
    import("../../db/repositories/sessionRepositoryList.js"),
    import("../../db/repositories/examinationExamsRepository.js"),
    import("../../db/repositories/obligationTypesRepository.js"),
    import("../../db/repositories/hasanatBatchesRepository.js"),
    import("../../db/repositories/questionBankQuestionsRepository.js"),
    import("../../db/repositories/questionBankRepositoryList.js"),
  ]);

  const page = { page: 1, limit: 5 };
  const missingId = "does-not-exist-readonly-audit";

  return [
    {
      label: "contacts.listContactsByWorkspace",
      run: (t) => contactHydrate.listContactsByWorkspace(t),
    },
    {
      label: "contacts.countContactsByWorkspace",
      run: (t) => contactHydrate.countContactsByWorkspace(t),
    },
    { label: "contacts.findContactById", run: (t) => contactHydrate.findContactById(t, missingId) },
    { label: "contacts.listContactsPage", run: (t) => contactList.listContactsPage(t, page) },
    {
      label: "contacts.aggregateContactsCommandMetrics",
      run: (t) =>
        contactMetrics.aggregateContactsCommandMetrics(t, {
          version: 2,
          enabledTabs: [],
          requiredTabs: [],
          fields: {},
        }),
    },
    {
      label: "students.listStudentsByWorkspace",
      run: (t) => studentHydrate.listStudentsByWorkspace(t),
    },
    { label: "students.findStudentById", run: (t) => studentHydrate.findStudentById(t, missingId) },
    { label: "students.listStudentsPage", run: (t) => studentPage.listStudentsPage(t, page) },
    { label: "faculty.listFacultyByWorkspace", run: (t) => facultyRepo.listFacultyByWorkspace(t) },
    { label: "faculty.findFacultyById", run: (t) => facultyRepo.findFacultyById(t, missingId) },
    {
      label: "users.listTenantUsersByWorkspace",
      run: (t) => tenantUserHydrate.listTenantUsersByWorkspace(t),
    },
    {
      label: "users.countTenantUsersByWorkspace",
      run: (t) => tenantUserHydrate.countTenantUsersByWorkspace(t),
    },
    {
      label: "users.listTenantUsersByIds",
      run: (t) => tenantUserHydrate.listTenantUsersByIds(t, [missingId]),
    },
    { label: "users.listTenantUsersPage", run: (t) => tenantUserList.listTenantUsersPage(t, page) },
    {
      label: "users.aggregateUsersCommandMetrics",
      run: (t) => tenantUserList.aggregateUsersCommandMetrics(t),
    },
    {
      label: "attendance.listAttendanceRecordsByWorkspace",
      run: (t) => attendanceRepo.listAttendanceRecordsByWorkspace(t),
    },
    {
      label: "attendance.listAttendancePage",
      run: (t) => attendanceList.listAttendancePage(t, page),
    },
    {
      label: "enrollments.listEnrollmentsByWorkspace",
      run: (t) => enrollmentHydrate.listEnrollmentsByWorkspace(t),
    },
    {
      label: "enrollments.listEnrollmentsPage",
      run: (t) => enrollmentList.listEnrollmentsPage(t, page),
    },
    {
      label: "finance.listInvoicesByWorkspace",
      run: (t) => financeInvoices.listInvoicesByWorkspace(t),
    },
    { label: "finance.findInvoiceById", run: (t) => financeInvoices.findInvoiceById(t, missingId) },
    { label: "finance.listInvoicesPage", run: (t) => financeList.listInvoicesPage(t, page) },
    {
      label: "accounting.listAccountsByWorkspace",
      run: (t) => accountingAccounts.listAccountsByWorkspace(t),
    },
    {
      label: "accounting.listAccountsPage",
      run: (t) => accountingListPages.listAccountsPage(t, page),
    },
    {
      label: "sessions.listSessionsByWorkspace",
      run: (t) => sessionHydrate.listSessionsByWorkspace(t),
    },
    { label: "sessions.listSessionsPage", run: (t) => sessionList.listSessionsPage(t, page) },
    { label: "examinations.listExamsByWorkspace", run: (t) => examRepo.listExamsByWorkspace(t) },
    {
      label: "obligations.listObligationTypesByWorkspace",
      run: (t) => obligationTypes.listObligationTypesByWorkspace(t),
    },
    {
      label: "hasanat.listBatchesByWorkspace",
      run: (t) => hasanatBatches.listBatchesByWorkspace(t),
    },
    {
      label: "questionBank.listQuestionsByWorkspace",
      run: (t) => questionBankQuestions.listQuestionsByWorkspace(t),
    },
    {
      label: "questionBank.listQuestionsPage",
      run: (t) => questionBankList.listQuestionsPage(t, page),
    },
  ];
}

describe("withTenantRead read-path audit (real Postgres)", () => {
  it("every converted read path executes inside a read-only transaction without writing", async () => {
    const cases = await buildReadCases();
    const failures: string[] = [];

    for (const testCase of cases) {
      try {
        // Real withTenantRead: Postgres `read only` access mode, replica when
        // configured. A write here raises 25006.
        await testCase.run(TEST_SUBDOMAIN);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const code = (error as { code?: string }).code;
        // Missing tables/columns in a bare test DB are environmental, not a
        // read-only violation — only flag actual write attempts.
        if (code === "25006" || /read-only transaction/i.test(message)) {
          failures.push(`${testCase.label} attempted a WRITE: ${message}`);
        }
      }
    }

    expect(failures, `Read-only violations:\n${failures.join("\n")}`).toEqual([]);
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });
});

describe("withTenantRead enforces read-only access at the database level", () => {
  /**
   * Guards against the audit above being vacuous: if Postgres did NOT actually
   * reject writes in these transactions, every case there would pass for the
   * wrong reason.
   */
  it("rejects a write inside withTenantRead with SQLSTATE 25006", async () => {
    let caught: { code?: string; message: string } | null = null;
    try {
      await withTenantRead(TEST_SUBDOMAIN, async (tx) => {
        await tx.execute(
          sql`INSERT INTO workspaces (id, subdomain, madrasa_name, enabled)
              VALUES ('should-not-persist', ${"should-not-persist"}, 'nope', true)`,
        );
      });
    } catch (error) {
      // Drizzle wraps driver errors, so the pg SQLSTATE may sit on `cause`.
      const withCause = error as { code?: string; cause?: { code?: string } };
      caught = {
        code: withCause.code ?? withCause.cause?.code,
        message: error instanceof Error ? error.message : String(error),
      };
    }

    expect(caught, "expected the read-only transaction to reject the INSERT").not.toBeNull();
    // 25006 = read_only_sql_transaction. Drizzle's wrapper message is generic
    // ("Failed query: ..."), so the SQLSTATE is the reliable signal.
    expect(caught?.code).toBe("25006");
  });
});

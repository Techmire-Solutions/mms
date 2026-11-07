import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { workspaces } from "../../db/schema.js";
import { saveSession } from "../../db/repositories/sessionRepositoryPersist.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import { listSessionsPage } from "../../db/repositories/sessionRepositoryList.js";
import { findPromotionRun } from "../../db/repositories/sessionPromotionRepository.js";
import { listSessionActivity } from "../../db/repositories/sessionActivityRepository.js";
import { createPromotionRun } from "../../db/repositories/sessionPromotionRepository.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT_A = "session-sec-a";
const TENANT_B = "session-sec-b";
const SESSION_A = "sec-a-session";
const SESSION_B = "sec-b-session";

async function purgeTenant(tenant: string): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.execute(sql`DELETE FROM audit_trail_events WHERE workspace_subdomain = ${tenant}`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
  });
}

async function seedTenant(tenant: string, sessionId: string): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await tx.insert(workspaces).values({
      id: tenant,
      subdomain: tenant,
      madrasaName: tenant,
      enabled: true,
    });
  });
  await saveSession(
    tenant,
    SessionSchema.parse({
      id: sessionId,
      name: `Session ${sessionId}`,
      status: "draft",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      overlapExempt: true,
      classes: [
        {
          id: `${sessionId}-class`,
          name: "Class A",
          sections: [{ id: `${sessionId}-sec`, name: "A" }],
        },
      ],
    }),
  );
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant(TENANT_A);
  await purgeTenant(TENANT_B);
  await seedTenant(TENANT_A, SESSION_A);
  await seedTenant(TENANT_B, SESSION_B);
});

afterAll(async () => {
  try {
    await purgeTenant(TENANT_A);
    await purgeTenant(TENANT_B);
  } finally {
    await closeDatabase();
  }
});

describe("sessions tenant isolation (real Postgres)", () => {
  it("never reads another tenant's session, list, activity or promotion run", async () => {
    expect(await findSessionById(TENANT_A, SESSION_B)).toBeNull();
    expect(await findSessionById(TENANT_B, SESSION_A)).toBeNull();
    const pageA = await listSessionsPage(TENANT_A, { page: 1, limit: 50 });
    expect(pageA.sessions.map((row) => row.id)).toEqual([SESSION_A]);
    expect(await listSessionActivity(TENANT_A, SESSION_B)).toEqual([]);
    await createPromotionRun(TENANT_B, {
      id: "sec-run-b",
      sourceSessionId: SESSION_B,
      mode: "duplicate",
      classMap: [],
      createdBy: "u-b",
    });
    expect(await findPromotionRun(TENANT_A, "sec-run-b")).toBeNull();
    expect((await findPromotionRun(TENANT_B, "sec-run-b"))?.id).toBe("sec-run-b");
  });

  it("enforces FORCE RLS with tenant policies on every sessions table", async () => {
    const tables = [
      "sessions",
      "session_classes",
      "session_class_sections",
      "session_faculty",
      "session_working_days",
      "session_class_fees",
      "session_class_schedules",
      "session_class_budgets",
      "session_class_discounts",
      "session_class_timetables",
      "session_class_timetable_periods",
      "session_class_refreshments",
      "session_class_scholarships",
      "scholarship_eligibilities",
      "section_staff_assignments",
      "section_student_roles",
      "session_promotion_runs",
      "session_promotion_class_map",
      "session_promotion_run_warnings",
      "session_field_configs",
      "session_module_preferences",
      "session_registration_links",
    ];
    const rows = await withTenant(TENANT_A, async (tx) => {
      const result = await tx.execute<{
        table: string;
        rls: boolean;
        forced: boolean;
        policies: number;
      }>(sql`
        SELECT c.relname AS "table",
               c.relrowsecurity AS rls,
               c.relforcerowsecurity AS forced,
               (SELECT count(*)::int FROM pg_policies p
                 WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
           AND c.relname IN (${sql.join(
             tables.map((table) => sql`${table}`),
             sql`, `,
           )})
      `);
      return result.rows;
    });
    for (const table of tables) {
      const row = rows.find((candidate) => candidate.table === table);
      expect(row, `${table} must exist`).toBeDefined();
      expect(row?.rls, `${table} RLS enabled`).toBe(true);
      expect(row?.forced, `${table} RLS forced`).toBe(true);
      expect(row?.policies, `${table} policy`).toBeGreaterThan(0);
    }
  });

  it("rejects an audit append addressed to another workspace", async () => {
    await expect(
      runWithTenant(TENANT_A, () =>
        recordModernAuditEvent({
          workspaceSubdomain: TENANT_B,
          tableName: "sessions",
          recordId: SESSION_B,
          actionType: "UPDATE",
          newState: { crossTenant: true },
        }),
      ),
    ).rejects.toThrow(/refusing to append/);
  });
});

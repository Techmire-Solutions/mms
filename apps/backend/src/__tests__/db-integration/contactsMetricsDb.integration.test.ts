import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { FieldConfig } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import { contactPhones, contacts, workspaces } from "../../db/schema.js";
import {
  aggregateContactsCommandMetrics,
  aggregateContactsReportAnalytics,
} from "../../db/repositories/contactRepositoryMetrics.js";
import { contactMetricsAggregateSql } from "../../db/repositories/contactMetricsSql.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Real-Postgres regression for the contacts metrics lateral aggregate: the
 * previous `count(*) FILTER (WHERE hasWhatsAppSql())` ran a correlated
 * `SELECT … ORDER BY … LIMIT 1` per contact (a `SubPlan` with a per-row Sort).
 * The helper must evaluate the primary phone once through a single
 * `LEFT JOIN LATERAL`, and the plan must contain no correlated `SubPlan`.
 */
const tenant = `contacts-metrics-${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

/** `phones` is the only required tab, so contacts without a phone are incomplete. */
const fieldConfig: FieldConfig = {
  version: 1,
  enabledTabs: ["phones"],
  requiredTabs: ["phones"],
  fields: {},
  formTabs: [{ key: "phones", label: "Phones", enabled: true, order: 1 }],
};

const contactWithPhonesId = "metrics-contact-phones";
const contactWithoutPhonesId = "metrics-contact-no-phones";

beforeAll(async () => {
  await requireDatabaseConnection();
  await withTenant(tenant, async (tx) => {
    await tx.insert(workspaces).values({
      id: tenant,
      subdomain: tenant,
      madrasaName: "Contacts metrics test",
      enabled: true,
    });
    await tx.insert(contacts).values([
      {
        id: contactWithPhonesId,
        workspaceSubdomain: tenant,
        firstName: "Ali",
        lastName: "Khan",
        name: "Ali Khan",
      },
      {
        id: contactWithoutPhonesId,
        workspaceSubdomain: tenant,
        firstName: "Sara",
        lastName: "Khan",
        name: "Sara Khan",
      },
    ]);
    await tx.insert(contactPhones).values([
      {
        id: "metrics-phone-primary",
        workspaceSubdomain: tenant,
        contactId: contactWithPhonesId,
        number: "+923001234567",
        label: "Mobile",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        id: "metrics-phone-secondary",
        workspaceSubdomain: tenant,
        contactId: contactWithPhonesId,
        number: "12345",
        label: "Other",
        isPrimary: false,
        sortOrder: 1,
      },
    ]);
  });
});

afterAll(async () => {
  try {
    await withTenant(tenant, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
    });
  } finally {
    await closeDatabase();
  }
});

describe("contacts metrics aggregate (Postgres)", () => {
  it("counts WhatsApp by the primary phone and incomplete by required tabs", async () => {
    const metrics = await aggregateContactsCommandMetrics(tenant, fieldConfig);

    expect(metrics.total).toBe(2);
    // Primary phone digits (12) are within the 8–15 WhatsApp window; the
    // contact with no phone does not match.
    expect(metrics.whatsappCount).toBe(1);
    // Only the contact without a phone is incomplete for requiredTabs: ["phones"].
    expect(metrics.incompleteCount).toBe(1);
  });

  it("uses the same lateral aggregate for report analytics", async () => {
    const report = await aggregateContactsReportAnalytics(tenant);

    expect(report.total).toBe(2);
    expect(report.whatsappCount).toBe(1);
    expect(report.whatsappRate).toBe(50);
    // Neither contact has an email, so both are missing profile info.
    expect(report.missingInfoCount).toBe(2);
  });

  it("plans the metrics aggregate without a correlated SubPlan", async () => {
    // `incompleteSql`/`missingInfo` are intentionally omitted here: their
    // index-backed EXISTS remain SubPlans by design (sort-free). This assertion
    // covers the lateral core that replaced the sorted phone subquery.
    const helperSql = contactMetricsAggregateSql({ subdomain: tenant, periodDays: 30 });
    const explain = await withTenant(tenant, (tx) =>
      tx.execute<Record<string, unknown>>(sql`EXPLAIN (FORMAT JSON) ${helperSql}`),
    );
    const planText = JSON.stringify(explain.rows[0]?.["QUERY PLAN"] ?? []);

    // The old correlated scalar subquery (with its per-contact Sort) is gone.
    expect(planText).not.toContain('"SubPlan"');
    // PostgreSQL renders `LEFT JOIN LATERAL` as a Nested Loop with Join Type Left.
    expect(planText).toContain('"Node Type":"Nested Loop"');
    expect(planText).toContain('"Join Type":"Left"');
    expect(planText).toContain('"Node Type":"Limit"');
  });
});

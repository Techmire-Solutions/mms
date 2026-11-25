import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "@mms/db/client";
import { withTenant } from "@mms/db/context";
import {
  financeInvoiceCounters,
  financeInvoices,
  financeModulePreferences,
  workspaces,
} from "@mms/db/schema";
import { requireDatabaseConnection } from "./dbTestSupport.js";
import { allocateInvoiceNumbers } from "../../db/repositories/financeBillingNumbering.js";

const tenant = "finance-invoice-counters";

async function seedInvoice(invoiceNumber: string): Promise<void> {
  await withTenant(tenant, (tx) =>
    tx.insert(financeInvoices).values({
      id: `seed-${invoiceNumber}`,
      workspaceSubdomain: tenant,
      studentId: "s-1",
      dueDate: "2026-09-01",
      invoiceNumber,
    }),
  );
}

async function savePreferences(preferences: Record<string, unknown>): Promise<void> {
  await withTenant(tenant, (tx) =>
    tx
      .insert(financeModulePreferences)
      .values({ workspaceSubdomain: tenant, preferences })
      .onConflictDoUpdate({
        target: financeModulePreferences.workspaceSubdomain,
        set: { preferences },
      }),
  );
}

async function resetCounters(): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await tx
      .delete(financeInvoiceCounters)
      .where(eq(financeInvoiceCounters.workspaceSubdomain, tenant));
    await tx
      .delete(financeModulePreferences)
      .where(eq(financeModulePreferences.workspaceSubdomain, tenant));
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(financeInvoices).where(eq(financeInvoices.workspaceSubdomain, tenant));
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await withTenant(tenant, (tx) =>
    tx.insert(workspaces).values({
      id: tenant,
      subdomain: tenant,
      madrasaName: "Finance invoice counter test",
      enabled: true,
    }),
  );
});

beforeEach(async () => {
  await resetCounters();
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

describe("finance invoice counters (Postgres)", () => {
  it("issues distinct numbers to concurrent transactions", async () => {
    const issued = await Promise.all(
      Array.from({ length: 8 }, () =>
        withTenant(tenant, () => allocateInvoiceNumbers(tenant, { date: "2026-09-01" })),
      ),
    );
    expect(issued.flat().sort()).toEqual(
      Array.from({ length: 8 }, (_, index) => `INV-2026-${String(index + 1).padStart(4, "0")}`),
    );
  });

  it("seeds numerically from existing invoice numbers", async () => {
    await seedInvoice("INV-2026-0004");
    await seedInvoice("INV-2026-0009");
    expect(await allocateInvoiceNumbers(tenant, { count: 2, date: "2026-09-01" })).toEqual([
      "INV-2026-0010",
      "INV-2026-0011",
    ]);
  });

  it("honours the full sequence config from preferences", async () => {
    await savePreferences({
      invoicePrefix: "BILL",
      invoiceDelimiter: "/",
      invoiceYearFormat: "YY",
      invoiceSequenceDigits: 5,
      invoiceStartingSequence: 100,
    });
    expect(await allocateInvoiceNumbers(tenant, { date: "2026-09-01" })).toEqual(["BILL/26/00100"]);
  });

  it("restarts per calendar year and prints that year", async () => {
    await savePreferences({
      invoicePrefix: "REC",
      invoiceSequenceDigits: 3,
      invoiceYearFormat: "YYYY",
      invoiceRolloverPolicy: "annual_calendar",
    });
    expect(await allocateInvoiceNumbers(tenant, { date: "2025-12-31" })).toEqual(["REC-2025-001"]);
    expect(await allocateInvoiceNumbers(tenant, { date: "2026-01-01" })).toEqual(["REC-2026-001"]);
    expect(await allocateInvoiceNumbers(tenant, { date: "2025-06-01" })).toEqual(["REC-2025-002"]);
  });

  it("restarts per month and prints the year-month", async () => {
    await savePreferences({
      invoicePrefix: "REC",
      invoiceSequenceDigits: 3,
      invoiceYearFormat: "YYYYMM",
      invoiceRolloverPolicy: "monthly",
    });
    expect(await allocateInvoiceNumbers(tenant, { date: "2026-11-15" })).toEqual([
      "REC-202611-001",
    ]);
    expect(await allocateInvoiceNumbers(tenant, { date: "2026-11-20" })).toEqual([
      "REC-202611-002",
    ]);
    expect(await allocateInvoiceNumbers(tenant, { date: "2026-12-01" })).toEqual([
      "REC-202612-001",
    ]);
    expect(await allocateInvoiceNumbers(tenant, { date: "2026-11-05" })).toEqual([
      "REC-202611-003",
    ]);
  });

  it("returns the number when the write transaction rolls back", async () => {
    await expect(
      withTenant(tenant, async () => {
        await allocateInvoiceNumbers(tenant, {});
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await allocateInvoiceNumbers(tenant, {})).toEqual(["INV-2026-0001"]);
  });

  it("rejects an annual restart with no year segment", async () => {
    await savePreferences({ invoiceYearFormat: "NONE", invoiceRolloverPolicy: "annual_calendar" });
    await expect(allocateInvoiceNumbers(tenant, {})).rejects.toThrow(/must include the year/);
  });

  it("allocates disjoint ranges to concurrent transactions that share a format", async () => {
    const issued = await Promise.all(
      Array.from({ length: 4 }, () =>
        withTenant(tenant, async () => allocateInvoiceNumbers(tenant, { count: 2 })),
      ),
    );
    const flat = issued.flat();
    expect(new Set(flat).size).toBe(flat.length);
    expect(flat.sort()).toEqual([
      "INV-2026-0001",
      "INV-2026-0002",
      "INV-2026-0003",
      "INV-2026-0004",
      "INV-2026-0005",
      "INV-2026-0006",
      "INV-2026-0007",
      "INV-2026-0008",
    ]);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "@mms/db/client";
import { withTenant } from "@mms/db/context";
import {
  contacts,
  mujtahidReps,
  mujtahids,
  obligationCollections,
  obligationModulePreferences,
  obligationReceiptCounters,
  obligationTypes,
  workspaces,
} from "@mms/db/schema";
import { requireDatabaseConnection } from "./dbTestSupport.js";
import { allocateObligationReceiptNumbers } from "@mms/mod-obligations/backend/repository";

const tenant = "obligation-receipt-counters";

async function seedCatalogue(): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await tx.insert(contacts).values({
      id: "contact-alloc-1",
      workspaceSubdomain: tenant,
      firstName: "Donor",
      name: "Donor Alloc",
    });
    await tx
      .insert(obligationTypes)
      .values({ id: "ot-alloc-1", workspaceSubdomain: tenant, name: "Khums" });
    await tx
      .insert(mujtahids)
      .values({ id: "mj-alloc-1", workspaceSubdomain: tenant, name: "Ayatullah Alloc" });
    await tx.insert(mujtahidReps).values({
      id: "rep-alloc-1",
      workspaceSubdomain: tenant,
      mujtahidId: "mj-alloc-1",
      name: "Rep Alloc",
    });
  });
}

async function seedReceipt(receiptNo: string, options: { deletedAt?: string } = {}): Promise<void> {
  await withTenant(tenant, (tx) =>
    tx.insert(obligationCollections).values({
      id: `seed-${receiptNo}`,
      workspaceSubdomain: tenant,
      receiptNo,
      receivedDate: "2026-06-15",
      senderId: "contact-alloc-1",
      amount: "100.00",
      currencyId: "pkr",
      paymentMode: "Cash",
      obligationTypeId: "ot-alloc-1",
      mujtahidRepresentativeId: "rep-alloc-1",
      receivedBy: "usr-1",
      ...(options.deletedAt ? { deletedAt: new Date(options.deletedAt) } : {}),
    }),
  );
}

async function savePreferences(preferences: Record<string, unknown>): Promise<void> {
  await withTenant(tenant, (tx) =>
    tx
      .insert(obligationModulePreferences)
      .values({ workspaceSubdomain: tenant, preferences })
      .onConflictDoUpdate({
        target: obligationModulePreferences.workspaceSubdomain,
        set: { preferences },
      }),
  );
}

async function resetCounters(): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await tx
      .delete(obligationReceiptCounters)
      .where(eq(obligationReceiptCounters.workspaceSubdomain, tenant));
    await tx
      .delete(obligationModulePreferences)
      .where(eq(obligationModulePreferences.workspaceSubdomain, tenant));
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx
      .delete(obligationCollections)
      .where(eq(obligationCollections.workspaceSubdomain, tenant));
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await withTenant(tenant, (tx) =>
    tx.insert(workspaces).values({
      id: tenant,
      subdomain: tenant,
      madrasaName: "Obligation receipt counter test",
      enabled: true,
    }),
  );
  await seedCatalogue();
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

describe("obligation receipt counters (Postgres)", () => {
  it("issues distinct numbers to concurrent transactions", async () => {
    const issued = await Promise.all(
      Array.from({ length: 8 }, () =>
        withTenant(tenant, () => allocateObligationReceiptNumbers(tenant, { date: "2026-03-01" })),
      ),
    );
    expect(issued.flat().sort()).toEqual(
      Array.from({ length: 8 }, (_, index) => `OBL-2026-${String(index + 1).padStart(5, "0")}`),
    );
  });

  it("seeds numerically from existing receipt numbers", async () => {
    await seedReceipt("OBL-2026-00004");
    await seedReceipt("OBL-2026-00009");
    expect(
      await allocateObligationReceiptNumbers(tenant, { count: 2, date: "2026-06-15" }),
    ).toEqual(["OBL-2026-00010", "OBL-2026-00011"]);
  });

  it("skips hand-typed and reserved receipt numbers the counter would otherwise reissue", async () => {
    expect(await allocateObligationReceiptNumbers(tenant, { date: "2026-06-15" })).toEqual([
      "OBL-2026-00001",
    ]);
    await seedReceipt("OBL-2026-00002");
    expect(
      await allocateObligationReceiptNumbers(tenant, {
        date: "2026-06-15",
        reserved: new Set(["OBL-2026-00003"]),
      }),
    ).toEqual(["OBL-2026-00004"]);
  });

  it("returns the number when the write transaction rolls back", async () => {
    await expect(
      withTenant(tenant, async () => {
        await allocateObligationReceiptNumbers(tenant, {});
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await allocateObligationReceiptNumbers(tenant, {})).toEqual(["OBL-2026-00001"]);
  });

  it("restarts per calendar year and prints that year", async () => {
    await savePreferences({
      receiptPrefix: "REC",
      receiptSequenceDigits: 3,
      receiptYearFormat: "YYYY",
      receiptRolloverPolicy: "annual_calendar",
    });
    expect(await allocateObligationReceiptNumbers(tenant, { date: "2025-12-31" })).toEqual([
      "REC-2025-001",
    ]);
    expect(await allocateObligationReceiptNumbers(tenant, { date: "2026-01-01" })).toEqual([
      "REC-2026-001",
    ]);
    expect(await allocateObligationReceiptNumbers(tenant, { date: "2025-06-01" })).toEqual([
      "REC-2025-002",
    ]);
  });

  it("restarts per month and prints the year-month", async () => {
    await savePreferences({
      receiptPrefix: "REC",
      receiptSequenceDigits: 3,
      receiptYearFormat: "YYYYMM",
      receiptRolloverPolicy: "monthly",
    });
    expect(await allocateObligationReceiptNumbers(tenant, { date: "2026-11-15" })).toEqual([
      "REC-202611-001",
    ]);
    expect(await allocateObligationReceiptNumbers(tenant, { date: "2026-11-20" })).toEqual([
      "REC-202611-002",
    ]);
    expect(await allocateObligationReceiptNumbers(tenant, { date: "2026-12-01" })).toEqual([
      "REC-202612-001",
    ]);
    expect(await allocateObligationReceiptNumbers(tenant, { date: "2026-11-05" })).toEqual([
      "REC-202611-003",
    ]);
  });

  it("honours a yearless never-restarting format with a single bucket", async () => {
    await savePreferences({
      receiptPrefix: "REC",
      receiptYearFormat: "NONE",
      receiptRolloverPolicy: "never",
    });
    expect(await allocateObligationReceiptNumbers(tenant, { date: "2025-06-01" })).toEqual([
      "REC-00001",
    ]);
    expect(await allocateObligationReceiptNumbers(tenant, { date: "2027-01-01" })).toEqual([
      "REC-00002",
    ]);
  });

  it("issues nothing when automatic receipt numbering is off", async () => {
    await savePreferences({ autoGenerateReceipt: false });
    expect(await allocateObligationReceiptNumbers(tenant, {})).toBeNull();
  });

  it("rejects an annual restart with no year segment", async () => {
    await savePreferences({
      receiptYearFormat: "NONE",
      receiptRolloverPolicy: "annual_calendar",
    });
    await expect(allocateObligationReceiptNumbers(tenant, {})).rejects.toThrow(
      /must include the year/,
    );
  });

  it("keeps one counter per format so a prefix change cannot reissue old receipts", async () => {
    expect(await allocateObligationReceiptNumbers(tenant, {})).toEqual(["OBL-2026-00001"]);
    await savePreferences({ receiptPrefix: "REC" });
    // Format key includes the prefix: the REC counter starts fresh…
    expect(await allocateObligationReceiptNumbers(tenant, {})).toEqual(["REC-2026-00001"]);
    // …and switching back resumes the OBL counter rather than restarting it.
    await savePreferences({ receiptPrefix: "OBL" });
    expect(await allocateObligationReceiptNumbers(tenant, {})).toEqual(["OBL-2026-00002"]);
  });

  it("allocates disjoint ranges to concurrent transactions that share a format", async () => {
    const issued = await Promise.all(
      Array.from({ length: 4 }, () =>
        withTenant(tenant, async () => {
          const numbers = await allocateObligationReceiptNumbers(tenant, { count: 2 });
          return numbers ?? [];
        }),
      ),
    );
    const flat = issued.flat();
    expect(new Set(flat).size).toBe(flat.length);
    expect(flat.sort()).toEqual([
      "OBL-2026-00001",
      "OBL-2026-00002",
      "OBL-2026-00003",
      "OBL-2026-00004",
      "OBL-2026-00005",
      "OBL-2026-00006",
      "OBL-2026-00007",
      "OBL-2026-00008",
    ]);
  });

  it("never reissues a number held only by a trashed receipt", async () => {
    await seedReceipt("OBL-2026-00001", { deletedAt: "2026-02-01T00:00:00.000Z" });
    expect(await allocateObligationReceiptNumbers(tenant, {})).toEqual(["OBL-2026-00002"]);
  });
});

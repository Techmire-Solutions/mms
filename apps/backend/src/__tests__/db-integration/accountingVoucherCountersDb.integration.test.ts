import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  accountingEntries,
  accountingFiscalYears,
  accountingVoucherCounters,
  accountingVoucherNumbering,
  workspaces,
} from "../../db/schema.js";
import { DEFAULT_VOUCHER_NUMBERING } from "@mms/shared";
import { requireDatabaseConnection } from "./dbTestSupport.js";
import {
  allocateVoucherNumbers,
  peekVoucherSequence,
  saveVoucherNumbering,
} from "../../db/repositories/accountingVoucherRepository.js";

const tenant = "accounting-voucher-counters";
let available = false;

async function seedEntryRefs(refs: string[]): Promise<void> {
  await withTenant(tenant, (tx) =>
    tx.insert(accountingEntries).values(
      refs.map((ref) => ({
        id: `seed-${ref}`,
        workspaceSubdomain: tenant,
        ref,
        date: "2026-03-01",
        description: "seed",
        status: "draft",
        createdBy: "test",
        fiscalYear: "",
      })),
    ),
  );
}

/** An entry carrying `ref` that is already archived — its number must not be reissued. */
async function seedTrashedRef(ref: string): Promise<void> {
  await withTenant(tenant, (tx) =>
    tx.insert(accountingEntries).values({
      id: `trashed-${ref}`,
      workspaceSubdomain: tenant,
      ref,
      date: "2026-03-01",
      description: "trashed",
      status: "draft",
      createdBy: "test",
      fiscalYear: "",
      deletedAt: new Date("2026-02-01T00:00:00.000Z"),
      deletedBy: "other-session",
    }),
  );
}

async function resetCounters(): Promise<void> {
  await withTenant(tenant, async (tx) => {
    await tx
      .delete(accountingVoucherCounters)
      .where(eq(accountingVoucherCounters.workspaceSubdomain, tenant));
    await tx
      .delete(accountingVoucherNumbering)
      .where(eq(accountingVoucherNumbering.workspaceSubdomain, tenant));
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(accountingEntries).where(eq(accountingEntries.workspaceSubdomain, tenant));
    await tx
      .delete(accountingFiscalYears)
      .where(eq(accountingFiscalYears.workspaceSubdomain, tenant));
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  available = true;
  await withTenant(tenant, (tx) =>
    tx.insert(workspaces).values({
      id: tenant,
      subdomain: tenant,
      madrasaName: "Voucher counter test",
      enabled: true,
    }),
  );
});

afterAll(async () => {
  try {
    if (available) {
      await withTenant(tenant, async (tx) => {
        await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
        await tx.delete(workspaces).where(eq(workspaces.subdomain, tenant));
      });
    }
  } finally {
    await closeDatabase();
  }
});

describe("journal voucher counters (Postgres)", () => {
  it("issues distinct numbers to concurrent transactions", async () => {
    await resetCounters();
    const issued = await Promise.all(
      Array.from({ length: 8 }, () =>
        withTenant(tenant, () => allocateVoucherNumbers(tenant, { date: "2026-03-01" })),
      ),
    );
    expect(issued.flat().sort()).toEqual(
      Array.from({ length: 8 }, (_, index) => `JE-${String(index + 1).padStart(4, "0")}`),
    );
  });

  it("seeds numerically from existing refs, past JE-9999", async () => {
    await resetCounters();
    await seedEntryRefs(["JE-9998", "JE-9999", "JE-10000", "JE-ABC"]);
    expect(await allocateVoucherNumbers(tenant, { count: 2 })).toEqual(["JE-10001", "JE-10002"]);
  });

  it("skips hand-typed refs the counter would otherwise reissue", async () => {
    await resetCounters();
    expect(await allocateVoucherNumbers(tenant, {})).toEqual(["JE-0001"]);
    await seedEntryRefs(["JE-0002"]);
    expect(await allocateVoucherNumbers(tenant, { reserved: new Set(["JE-0003"]) })).toEqual([
      "JE-0004",
    ]);
  });

  it("returns the number when the write transaction rolls back", async () => {
    await resetCounters();
    await expect(
      withTenant(tenant, async () => {
        await allocateVoucherNumbers(tenant, {});
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await allocateVoucherNumbers(tenant, {})).toEqual(["JE-0001"]);
  });

  it("jumps past a run of hand-typed refs instead of probing one by one", async () => {
    await resetCounters();
    expect(await allocateVoucherNumbers(tenant, {})).toEqual(["JE-0001"]);
    await seedEntryRefs(
      Array.from({ length: 79 }, (_, index) => `JE-${String(index + 2).padStart(4, "0")}`),
    );
    expect(await allocateVoucherNumbers(tenant, {})).toEqual(["JE-0081"]);
  });

  it("honours the starting sequence", async () => {
    await resetCounters();
    await saveVoucherNumbering(tenant, {
      ...DEFAULT_VOUCHER_NUMBERING,
      prefix: "JV",
      startingSequence: 1000,
    });
    expect(await allocateVoucherNumbers(tenant, {})).toEqual(["JV-1000"]);
  });

  it("restarts per calendar year and prints that year", async () => {
    await resetCounters();
    await saveVoucherNumbering(tenant, {
      ...DEFAULT_VOUCHER_NUMBERING,
      prefix: "JV",
      sequenceDigits: 3,
      yearFormat: "YYYY",
      rolloverPolicy: "annual_calendar",
    });
    expect(await allocateVoucherNumbers(tenant, { date: "2025-12-31" })).toEqual(["JV-2025-001"]);
    expect(await allocateVoucherNumbers(tenant, { date: "2026-01-01" })).toEqual(["JV-2026-001"]);
    expect(await allocateVoucherNumbers(tenant, { date: "2025-06-01" })).toEqual(["JV-2025-002"]);
    const peek = await peekVoucherSequence(tenant, "2026-05-05");
    expect(peek).toMatchObject({ period: { periodYear: 2026, printYear: 2026 }, lastValue: 1 });
  });

  it("restarts per fiscal year using the stored fiscal year, then the start-month preference", async () => {
    await resetCounters();
    await withTenant(tenant, (tx) =>
      tx.insert(accountingFiscalYears).values({
        id: "fy-2025",
        workspaceSubdomain: tenant,
        label: "FY 2025-26",
        startDate: "2025-07-01",
        endDate: "2026-06-30",
      }),
    );
    await saveVoucherNumbering(tenant, {
      ...DEFAULT_VOUCHER_NUMBERING,
      prefix: "JV",
      delimiter: "/",
      yearFormat: "YYYY",
      rolloverPolicy: "annual_fiscal",
    });
    expect(await allocateVoucherNumbers(tenant, { date: "2025-07-01" })).toEqual(["JV/2025/0001"]);
    expect(await allocateVoucherNumbers(tenant, { date: "2026-06-30" })).toEqual(["JV/2025/0002"]);
    // No stored fiscal year covers July 2026: the default July start month applies.
    expect(await allocateVoucherNumbers(tenant, { date: "2026-07-01" })).toEqual(["JV/2026/0001"]);
  });

  it("issues nothing when automatic numbering is off", async () => {
    await resetCounters();
    await saveVoucherNumbering(tenant, { ...DEFAULT_VOUCHER_NUMBERING, autoGenerate: false });
    expect(await allocateVoucherNumbers(tenant, {})).toBeNull();
  });

  it("never reissues a number held only by a trashed entry", async () => {
    await resetCounters();
    // The archived row is invisible to the app, but reissuing its ref would make
    // a later restore fail on the active-unique index. The seed scan deliberately
    // includes trashed refs.
    await seedTrashedRef("JE-0001");
    expect(await allocateVoucherNumbers(tenant, {})).toEqual(["JE-0002"]);
  });

  it("keeps one counter per format so a prefix change cannot reissue old refs", async () => {
    await resetCounters();
    expect(await allocateVoucherNumbers(tenant, {})).toEqual(["JE-0001"]);
    await saveVoucherNumbering(tenant, { ...DEFAULT_VOUCHER_NUMBERING, prefix: "JV" });
    // Format key includes the prefix: the JV counter starts fresh…
    expect(await allocateVoucherNumbers(tenant, {})).toEqual(["JV-0001"]);
    // …and switching back resumes the JE counter rather than restarting it.
    await saveVoucherNumbering(tenant, { ...DEFAULT_VOUCHER_NUMBERING, prefix: "JE" });
    expect(await allocateVoucherNumbers(tenant, {})).toEqual(["JE-0002"]);
  });

  it("allocates disjoint ranges to concurrent transactions that share a format", async () => {
    await resetCounters();
    // Two independent writers race for the same counter row. Each transaction
    // keeps its numbers (nothing is committed until it ends), so a duplicate
    // here would mean the row lock was not held.
    const issued = await Promise.all(
      Array.from({ length: 4 }, () =>
        withTenant(tenant, async () => {
          const refs = await allocateVoucherNumbers(tenant, { count: 2 });
          return refs ?? [];
        }),
      ),
    );
    const flat = issued.flat();
    expect(new Set(flat).size).toBe(flat.length);
    expect(flat.sort()).toEqual([
      "JE-0001",
      "JE-0002",
      "JE-0003",
      "JE-0004",
      "JE-0005",
      "JE-0006",
      "JE-0007",
      "JE-0008",
    ]);
  });

  it("reuses a rolled-back batch without duplicating a committed batch", async () => {
    await resetCounters();
    const rolledBack = withTenant(tenant, async () => {
      await allocateVoucherNumbers(tenant, { count: 2 });
      throw new Error("rollback");
    });
    const committed = withTenant(tenant, () => allocateVoucherNumbers(tenant, { count: 2 }));
    const [rollbackResult, committedResult] = await Promise.allSettled([rolledBack, committed]);
    expect(rollbackResult.status).toBe("rejected");
    expect(committedResult.status).toBe("fulfilled");
    const committedRefs = (committedResult as PromiseFulfilledResult<string[] | null>).value ?? [];
    expect(committedRefs).toHaveLength(2);

    const after = (await allocateVoucherNumbers(tenant, { count: 2 })) ?? [];
    expect(after).toHaveLength(2);
    const all = [...committedRefs, ...after];
    // No duplicate can be issued even when the freed range is handed out again.
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set(["JE-0001", "JE-0002", "JE-0003", "JE-0004"]));
  });
});

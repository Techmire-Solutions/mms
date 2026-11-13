import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { accountingFiscalYears, workspaces } from "../../db/schema.js";
import {
  findOverlappingFiscalYearPair,
  upsertFiscalYearsHelper,
} from "../../accounting/use-cases/accountingAccountLifecycleUseCases.js";
import { accountingRepository } from "../../accounting/repository/accountingRepositoryAdapter.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const SUFFIX = randomUUID().slice(0, 8);
const TENANT = `fy-overlap-${SUFFIX}`;
const FIRST = `fy-first-${SUFFIX}`;
const SECOND = `fy-second-${SUFFIX}`;
const THIRD = `fy-third-${SUFFIX}`;

function year(id: string, label: string, startDate: string, endDate: string) {
  return { id, label, startDate, endDate, status: "active" as const };
}

async function purge(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.execute(
      sql.raw(`DELETE FROM accounting_fiscal_years WHERE workspace_subdomain = '${TENANT}'`),
    );
    await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${TENANT}`);
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await withGlobalTenant(async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: "Fiscal overlap",
      enabled: true,
    });
  });
  await runWithTenant(TENANT, () =>
    upsertFiscalYearsHelper(accountingRepository, [
      year(FIRST, "FY 2025", "2025-01-01", "2025-12-31"),
    ]),
  );
});

afterAll(async () => {
  await purge();
  await closeDatabase();
});

describe("fiscal-year ranges must not overlap", () => {
  it("accepts an adjacent year", async () => {
    await expect(
      runWithTenant(TENANT, () =>
        upsertFiscalYearsHelper(accountingRepository, [
          year(SECOND, "FY 2026", "2026-01-01", "2026-12-31"),
        ]),
      ),
    ).resolves.toBeDefined();
  });

  it("rejects an overlapping year with a readable error", async () => {
    await expect(
      runWithTenant(TENANT, () =>
        upsertFiscalYearsHelper(accountingRepository, [
          year(THIRD, "FY 2026 short", "2026-06-01", "2026-12-31"),
        ]),
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining("overlap"),
    });
  });

  it("detects overlap in one already-stored pair", async () => {
    const pair = findOverlappingFiscalYearPair([
      year(FIRST, "FY 2025", "2025-01-01", "2025-12-31"),
      year(SECOND, "FY 2026", "2026-01-01", "2026-12-31"),
      { ...year(THIRD, "deleted", "2026-06-01", "2026-12-31"), deletedAt: "2026-07-01" },
    ]);
    expect(pair).toBeNull();
    const overlapping = findOverlappingFiscalYearPair([
      year(FIRST, "A", "2026-01-01", "2026-12-31"),
      year(SECOND, "B", "2026-06-01", "2026-12-31"),
    ]);
    expect(overlapping?.map((row) => row.label)).toEqual(["A", "B"]);
  });

  it("still refuses overlaps at the database level", async () => {
    // The application guard returns a 422; the exclusion constraint is the last
    // line of defence for direct SQL and future write paths.
    await expect(
      withTenant(TENANT, (tx) =>
        tx
          .insert(accountingFiscalYears)
          .values({
            id: THIRD,
            workspaceSubdomain: TENANT,
            label: "direct insert",
            startDate: "2026-06-01",
            endDate: "2026-12-31",
            status: "active",
          })
          .then(() => undefined),
      ),
    ).rejects.toMatchObject({ cause: { code: "23P01" } });
  });

  it("ignores an archived year", async () => {
    await withTenant(TENANT, (tx) =>
      tx
        .update(accountingFiscalYears)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(accountingFiscalYears.workspaceSubdomain, TENANT),
            eq(accountingFiscalYears.id, FIRST),
          ),
        ),
    );
    await expect(
      runWithTenant(TENANT, () =>
        upsertFiscalYearsHelper(accountingRepository, [
          year(THIRD, "FY 2025 replacement", "2025-01-01", "2025-12-31"),
        ]),
      ),
    ).resolves.toBeDefined();
  });
});

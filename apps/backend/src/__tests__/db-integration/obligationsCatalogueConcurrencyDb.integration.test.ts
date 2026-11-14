import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant, withTenantRead } from "../../db/tenant-context.js";
import {
  mujtahidReps,
  mujtahids,
  obligationDistributions,
  obligationTypes,
  wakalaTypes,
  workspaces,
} from "../../db/schema.js";
import type { ObligationDistribution, WakalaType } from "@mms/shared";
import { replaceWakalaAggregateForWorkspace } from "../../db/repositories/obligationWakalaRepository.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Two Setup sessions replacing the wakala aggregate at the same time.
 *
 * The aggregate writes the wakalas and their split rules in one transaction. This suite proves that
 * a concurrent replace cannot leave a half-written catalogue — no distribution pointing at a wakala
 * that is not there, and the surviving set is entirely one caller's (test-suite audit 2, G3).
 */

const TENANT = `obl-catconc-${randomUUID().slice(0, 8)}`;

function wakala(id: string, name: string): WakalaType {
  return {
    id,
    name,
    mujtahid_representative_id: "rep-cat",
    obligation_type_id: "ot-cat",
  } as WakalaType;
}

function rule(id: string, wakalaId: string, percentage: number): ObligationDistribution {
  return {
    id,
    name: id,
    wakala_type_id: wakalaId,
    type: "Income",
    percentage,
  } as ObligationDistribution;
}

const SET_A = { wakalas: [wakala("wt-a", "Set A")], rules: [rule("od-a", "wt-a", 100)] };
const SET_B = {
  wakalas: [wakala("wt-b", "Set B")],
  rules: [rule("od-b", "wt-b", 60), rule("od-b2", "wt-b", 40)],
};

async function currentCatalogue() {
  return withTenantRead(TENANT, async (tx) => {
    const wakalas = await tx
      .select({ id: wakalaTypes.id })
      .from(wakalaTypes)
      .where(eq(wakalaTypes.workspaceSubdomain, TENANT));
    const rules = await tx
      .select({
        id: obligationDistributions.id,
        wakalaTypeId: obligationDistributions.wakalaTypeId,
      })
      .from(obligationDistributions)
      .where(eq(obligationDistributions.workspaceSubdomain, TENANT));
    return { wakalas: wakalas.map((row) => row.id), rules };
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await withGlobalTenant(async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Catalogue concurrency" })
      .onConflictDoNothing();
  });
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(obligationTypes)
      .values({ id: "ot-cat", workspaceSubdomain: TENANT, name: "Khums" })
      .onConflictDoNothing();
    await tx
      .insert(mujtahids)
      .values({ id: "mj-cat", workspaceSubdomain: TENANT, name: "Mujtahid" })
      .onConflictDoNothing();
    await tx
      .insert(mujtahidReps)
      .values({
        id: "rep-cat",
        workspaceSubdomain: TENANT,
        mujtahidId: "mj-cat",
        name: "Representative",
      })
      .onConflictDoNothing();
  });
}, 120_000);

beforeEach(async () => {
  // Start from set A so both racers have a previous aggregate to replace.
  await replaceWakalaAggregateForWorkspace(TENANT, SET_A.wakalas, SET_A.rules);
});

afterAll(async () => {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx
      .delete(obligationDistributions)
      .where(eq(obligationDistributions.workspaceSubdomain, TENANT));
    await tx.delete(wakalaTypes).where(eq(wakalaTypes.workspaceSubdomain, TENANT));
    await tx.delete(mujtahidReps).where(eq(mujtahidReps.workspaceSubdomain, TENANT));
    await tx.delete(mujtahids).where(eq(mujtahids.workspaceSubdomain, TENANT));
    await tx.delete(obligationTypes).where(eq(obligationTypes.workspaceSubdomain, TENANT));
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  }).catch(() => undefined);
  await closeDatabase();
});

describe("catalogue aggregate concurrency", () => {
  it("leaves one caller's whole set, never a mixture", async () => {
    await Promise.all([
      replaceWakalaAggregateForWorkspace(TENANT, SET_A.wakalas, SET_A.rules),
      replaceWakalaAggregateForWorkspace(TENANT, SET_B.wakalas, SET_B.rules),
    ]);

    const catalogue = await currentCatalogue();
    const isSetA = catalogue.wakalas.length === 1 && catalogue.wakalas[0] === "wt-a";
    const isSetB = catalogue.wakalas.length === 1 && catalogue.wakalas[0] === "wt-b";
    expect(isSetA || isSetB).toBe(true);

    // Whichever won, its rules are complete and point at a wakala that exists.
    const expectedRules = isSetA ? ["od-a"] : ["od-b", "od-b2"];
    expect(catalogue.rules.map((row) => row.id).sort()).toEqual(expectedRules.sort());
    for (const row of catalogue.rules) {
      expect(catalogue.wakalas).toContain(row.wakalaTypeId);
    }
  });

  it("never leaves an orphaned distribution behind", async () => {
    await Promise.all([
      replaceWakalaAggregateForWorkspace(TENANT, SET_B.wakalas, SET_B.rules),
      replaceWakalaAggregateForWorkspace(TENANT, SET_A.wakalas, SET_A.rules),
    ]);

    const orphans = await withTenantRead(TENANT, async (tx) => {
      const rows = await tx
        .select({
          id: obligationDistributions.id,
          wakalaTypeId: obligationDistributions.wakalaTypeId,
        })
        .from(obligationDistributions)
        .where(
          and(
            eq(obligationDistributions.workspaceSubdomain, TENANT),
            inArray(obligationDistributions.wakalaTypeId, ["wt-a", "wt-b"]),
          ),
        );
      const wakalas = await tx
        .select({ id: wakalaTypes.id })
        .from(wakalaTypes)
        .where(eq(wakalaTypes.workspaceSubdomain, TENANT));
      const live = new Set(wakalas.map((row) => row.id));
      return rows.filter((row) => !live.has(row.wakalaTypeId));
    });

    expect(orphans).toHaveLength(0);
  });

  it("rolls the previous aggregate back when a replace fails", async () => {
    // A rule pointing at an account outside the chart is rejected by the repository's validation.
    const broken: ObligationDistribution[] = [
      {
        id: "od-broken",
        name: "Broken",
        wakala_type_id: "wt-a",
        type: "Income",
        percentage: 100,
        account_id: "account-that-does-not-exist",
      } as ObligationDistribution,
    ];

    await expect(
      replaceWakalaAggregateForWorkspace(TENANT, SET_B.wakalas, broken),
    ).rejects.toThrow();

    const catalogue = await currentCatalogue();
    expect(catalogue.wakalas).toEqual(["wt-a"]);
    expect(catalogue.rules.map((row) => row.id)).toEqual(["od-a"]);
  });
});

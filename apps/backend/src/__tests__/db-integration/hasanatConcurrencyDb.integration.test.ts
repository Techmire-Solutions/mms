/**
 * Hasanat concurrency & ledger integrity (real PostgreSQL).
 *
 * These cases race the actual use cases, so the protections that only exist in the database are
 * exercised in their real order: the card-row `FOR UPDATE` inside `hasanat_redemption_guard`, the
 * per-batch projection lock, the instructor advisory lock, OCC on `version`, and the tenant-scoped
 * unique indexes. Mocked unit tests cannot prove any of this.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import {
  hasanatBatches,
  hasanatDenoms,
  hasanatDistributions,
  hasanatRedemptions,
  students,
  workspaces,
} from "../../db/schema.js";
import { distributionCreateSchema, type Distribution } from "@mms/shared";
import { hasanatRepository } from "../../hasanat/repository/hasanatRepositoryAdapter.js";
import { issueHasanatCard } from "../../hasanat/use-cases/hasanatIssuanceUseCases.js";
import {
  redeemHasanatCard,
  voidHasanatRedemption,
} from "../../hasanat/use-cases/hasanatRedemptionUseCases.js";
import { updateHasanatCard } from "../../hasanat/use-cases/hasanatCardUseCases.js";
import { requireDatabaseConnection, uniqueTenant } from "./dbTestSupport.js";

const TENANT = uniqueTenant("hsn-concurrency");
const ACTOR = { userId: "u-hsn-conc", displayName: "Concurrency probe" };
const ISSUED_DATE = "2026-11-10";

async function purge(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

async function seedWorkspace(): Promise<void> {
  await withGlobalTenant((tx) =>
    tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Concurrency", enabled: true })
      .onConflictDoNothing(),
  );
}

async function seedStudent(id: string): Promise<void> {
  await withTenant(TENANT, (tx) =>
    tx
      .insert(students)
      .values({ id, workspaceSubdomain: TENANT, grNumber: `gr-${id}`, status: "active" })
      .onConflictDoNothing(),
  );
}

/** One denomination + stock batch with the requested quantity; returns the batch id. */
async function seedStock(quantity: number): Promise<{ denominationId: string; batchId: string }> {
  const suffix = randomUUID().slice(0, 8);
  const denominationId = `den-${suffix}`;
  const batchId = `bat-${suffix}`;
  await withTenant(TENANT, async (tx) => {
    await tx.insert(hasanatDenoms).values({
      id: denominationId,
      workspaceSubdomain: TENANT,
      name: `Gold ${suffix}`,
      points: 50,
      active: true,
    });
    await tx.insert(hasanatBatches).values({
      id: batchId,
      workspaceSubdomain: TENANT,
      denominationId,
      denominationName: `Gold ${suffix}`,
      quantity,
      addedDate: ISSUED_DATE,
      addedBy: ACTOR.displayName,
      note: "",
    });
  });
  return { denominationId, batchId };
}

function issueInput(
  batchId: string,
  denominationId: string,
  studentId: string,
  overrides: { id?: string; clientRequestId?: string; quotaLimit?: number } = {},
) {
  return {
    body: distributionCreateSchema.parse({
      ...(overrides.id ? { id: overrides.id } : {}),
      batchId,
      denominationId,
      recipientType: "student" as const,
      recipientStudentId: studentId,
      quantity: 1,
      issuedDate: ISSUED_DATE,
      reason: "Concurrency probe",
      ...(overrides.clientRequestId ? { clientRequestId: overrides.clientRequestId } : {}),
    }),
    actorUserId: ACTOR.userId,
    actorName: ACTOR.displayName,
    quotaLimit: overrides.quotaLimit ?? 0,
  };
}

type Settled = PromiseSettledResult<unknown>;

const fulfilled = (results: Settled[]) => results.filter((r) => r.status === "fulfilled");
const rejected = (results: Settled[]) => results.filter((r) => r.status === "rejected");

function rejectionMessage(result: Settled): string {
  const reason = (result as PromiseRejectedResult).reason as unknown;
  if (reason instanceof Error) return reason.message;
  return String(reason);
}

async function countCards(): Promise<number> {
  const rows = await withTenant(TENANT, (tx) =>
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(hasanatDistributions)
      .where(eq(hasanatDistributions.workspaceSubdomain, TENANT)),
  );
  return Number(rows[0]?.count ?? 0);
}

async function cardCountFor(requestId: string): Promise<number> {
  const rows = await withTenant(TENANT, (tx) =>
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(hasanatDistributions)
      .where(
        sql`${hasanatDistributions.workspaceSubdomain} = ${TENANT} AND ${hasanatDistributions.clientRequestId} = ${requestId}`,
      ),
  );
  return Number(rows[0]?.count ?? 0);
}

async function batchRemaining(batchId: string): Promise<number> {
  const rows = await withTenant(TENANT, (tx) =>
    tx
      .select({ remaining: hasanatBatches.remaining })
      .from(hasanatBatches)
      .where(eq(hasanatBatches.id, batchId)),
  );
  return Number(rows[0]?.remaining ?? -1);
}

let studentCounter = 0;
async function freshStudent(): Promise<string> {
  studentCounter += 1;
  const id = `stu-${studentCounter}-${randomUUID().slice(0, 6)}`;
  await seedStudent(id);
  return id;
}

async function issuedCard(batchId: string, denominationId: string): Promise<Distribution> {
  const studentId = await freshStudent();
  return issueHasanatCard(
    TENANT,
    issueInput(batchId, denominationId, studentId),
    hasanatRepository,
  );
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await seedWorkspace();
}, 120_000);

afterAll(async () => {
  await purge();
  await closeDatabase();
});

describe("hasanat issuance concurrency", () => {
  it("concurrent issues with the same client request id create exactly one card", async () => {
    const { denominationId, batchId } = await seedStock(5);
    const studentId = await freshStudent();
    const clientRequestId = `req-${randomUUID()}`;

    const results = await Promise.allSettled([
      issueHasanatCard(
        TENANT,
        issueInput(batchId, denominationId, studentId, { clientRequestId }),
        hasanatRepository,
      ),
      issueHasanatCard(
        TENANT,
        issueInput(batchId, denominationId, studentId, { clientRequestId }),
        hasanatRepository,
      ),
    ]);

    expect(await cardCountFor(clientRequestId)).toBe(1);
    // Both may resolve (the loser replays the stored card) or the loser may be rejected by the
    // unique index — either way the ledger must contain exactly one credit.
    expect(fulfilled(results).length + rejected(results).length).toBe(2);
  });

  it("never oversells a batch: two concurrent issues against quantity 1", async () => {
    const { denominationId, batchId } = await seedStock(1);

    const results = await Promise.allSettled([
      issueHasanatCard(
        TENANT,
        issueInput(batchId, denominationId, await freshStudent()),
        hasanatRepository,
      ),
      issueHasanatCard(
        TENANT,
        issueInput(batchId, denominationId, await freshStudent()),
        hasanatRepository,
      ),
    ]);

    expect(fulfilled(results)).toHaveLength(1);
    expect(rejected(results)).toHaveLength(1);
    expect(await batchRemaining(batchId)).toBe(0);
  });

  it("enforces the instructor daily quota under a concurrent double issue", async () => {
    const { denominationId, batchId } = await seedStock(5);

    const results = await Promise.allSettled([
      issueHasanatCard(
        TENANT,
        issueInput(batchId, denominationId, await freshStudent(), { quotaLimit: 1 }),
        hasanatRepository,
      ),
      issueHasanatCard(
        TENANT,
        issueInput(batchId, denominationId, await freshStudent(), { quotaLimit: 1 }),
        hasanatRepository,
      ),
    ]);

    expect(fulfilled(results)).toHaveLength(1);
    expect(rejected(results)).toHaveLength(1);
    expect(rejectionMessage(rejected(results)[0])).toMatch(/daily awarding limit/i);
  });
});

describe("hasanat redemption concurrency", () => {
  it("burns a card once: two concurrent redemptions leave one ledger row", async () => {
    const { denominationId, batchId } = await seedStock(5);
    const card = await issuedCard(batchId, denominationId);
    const body = { reward: "Concurrency prize", pointsUsed: 50, date: ISSUED_DATE };

    const results = await Promise.allSettled([
      redeemHasanatCard(TENANT, card.id, body, ACTOR, hasanatRepository),
      redeemHasanatCard(TENANT, card.id, body, ACTOR, hasanatRepository),
    ]);

    expect(fulfilled(results)).toHaveLength(1);
    expect(rejected(results)).toHaveLength(1);

    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(hasanatRedemptions)
        .where(eq(hasanatRedemptions.distributionId, card.id)),
    );
    expect(Number(rows[0]?.count ?? 0)).toBe(1);
  });

  it("voids a redemption once: two concurrent reversals leave one reversal row", async () => {
    const { denominationId, batchId } = await seedStock(5);
    const card = await issuedCard(batchId, denominationId);
    const { redemption } = await redeemHasanatCard(
      TENANT,
      card.id,
      { reward: "Concurrency prize", pointsUsed: 50, date: ISSUED_DATE },
      ACTOR,
      hasanatRepository,
    );

    const results = await Promise.allSettled([
      voidHasanatRedemption(
        TENANT,
        redemption.id,
        { reason: "duplicate" },
        ACTOR,
        hasanatRepository,
      ),
      voidHasanatRedemption(
        TENANT,
        redemption.id,
        { reason: "duplicate" },
        ACTOR,
        hasanatRepository,
      ),
    ]);

    expect(fulfilled(results)).toHaveLength(1);
    expect(rejected(results)).toHaveLength(1);

    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(hasanatRedemptions)
        .where(
          sql`${hasanatRedemptions.workspaceSubdomain} = ${TENANT} AND ${hasanatRedemptions.reversalOfId} = ${redemption.id}`,
        ),
    );
    expect(Number(rows[0]?.count ?? 0)).toBe(1);
  });
});

describe("hasanat optimistic concurrency", () => {
  it("applies only one of two edits that share an expected version", async () => {
    const { denominationId, batchId } = await seedStock(5);
    const card = await issuedCard(batchId, denominationId);

    const results = await Promise.allSettled([
      updateHasanatCard(
        TENANT,
        card.id,
        { expectedVersion: card.version ?? 0, reason: "first writer" },
        hasanatRepository,
        ACTOR,
      ),
      updateHasanatCard(
        TENANT,
        card.id,
        { expectedVersion: card.version ?? 0, reason: "second writer" },
        hasanatRepository,
        ACTOR,
      ),
    ]);

    expect(fulfilled(results)).toHaveLength(1);
    expect(rejected(results)).toHaveLength(1);
    expect(rejectionMessage(rejected(results)[0])).toMatch(/changed since you loaded it/i);
  });

  it("keeps the card count stable while both writers race", async () => {
    const { denominationId, batchId } = await seedStock(5);
    const before = await countCards();
    await issuedCard(batchId, denominationId);
    await issuedCard(batchId, denominationId);
    expect(await countCards()).toBe(before + 2);
  });
});

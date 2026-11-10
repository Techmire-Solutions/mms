/**
 * Hasanat lifecycle & cascade invariants (real PostgreSQL).
 *
 * Covers the guarantees that live in DDL rather than in a use case: the stamped card value and its
 * immutability guard, session attribution, the append-only ledger, soft-delete/restore with a
 * hard-delete refusal, and what happens to cards when the student or the session they belong to is
 * purged.
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
  sessionClasses,
  sessions,
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
import {
  bulkRestoreDistributions,
  bulkSoftDeleteDistributions,
} from "../../db/repositories/hasanatDistributionsPersist.js";
import { listDistributionsPage } from "../../db/repositories/hasanatRepositoryList.js";
import { requireDatabaseConnection, uniqueTenant } from "./dbTestSupport.js";

const TENANT = uniqueTenant("hsn-lifecycle");
const ACTOR = { userId: "u-hsn-life", displayName: "Lifecycle probe" };
const STUDENT = `stu-${randomUUID().slice(0, 8)}`;
/** A second learner so the student-purge case cannot break the later session/purge cases. */
const STUDENT_2 = `stu2-${randomUUID().slice(0, 8)}`;
const SESSION = `ses-${randomUUID().slice(0, 8)}`;
const CLASS = `cls-${randomUUID().slice(0, 8)}`;
const DENOM = `den-${randomUUID().slice(0, 8)}`;
const BATCH = `bat-${randomUUID().slice(0, 8)}`;
const ISSUED_DATE = "2026-11-10";

async function purge(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

async function issueCard(studentId: string = STUDENT): Promise<Distribution> {
  return issueHasanatCard(
    TENANT,
    {
      body: distributionCreateSchema.parse({
        batchId: BATCH,
        denominationId: DENOM,
        recipientType: "student",
        recipientStudentId: studentId,
        classId: CLASS,
        quantity: 2,
        issuedDate: ISSUED_DATE,
        reason: "Lifecycle probe",
      }),
      actorUserId: ACTOR.userId,
      actorName: ACTOR.displayName,
      quotaLimit: 0,
    },
    hasanatRepository,
  );
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await withGlobalTenant((tx) =>
    tx
      .insert(workspaces)
      .values({ id: `ws-${TENANT}`, subdomain: TENANT, madrasaName: "Lifecycle", enabled: true }),
  );
  await withTenant(TENANT, async (tx) => {
    await tx.insert(students).values([
      { id: STUDENT, workspaceSubdomain: TENANT, grNumber: `gr-${STUDENT}`, status: "active" },
      { id: STUDENT_2, workspaceSubdomain: TENANT, grNumber: `gr-${STUDENT_2}`, status: "active" },
    ]);
    await tx.insert(sessions).values({
      id: SESSION,
      workspaceSubdomain: TENANT,
      name: "Lifecycle session",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    await tx.insert(sessionClasses).values({
      id: CLASS,
      workspaceSubdomain: TENANT,
      sessionId: SESSION,
      name: "Lifecycle class",
    });
    await tx.insert(hasanatDenoms).values({
      id: DENOM,
      workspaceSubdomain: TENANT,
      name: "Gold",
      points: 50,
      active: true,
    });
    await tx.insert(hasanatBatches).values({
      id: BATCH,
      workspaceSubdomain: TENANT,
      denominationId: DENOM,
      denominationName: "Gold",
      quantity: 100,
      addedDate: ISSUED_DATE,
      addedBy: ACTOR.displayName,
      note: "",
    });
  });
}, 120_000);

afterAll(async () => {
  await purge();
  await closeDatabase();
});

describe("hasanat card issuance invariants", () => {
  it("stamps the immutable value and attributes the session from the class", async () => {
    const card = await issueCard();

    expect(card.pointsSnapshot).toBe(100); // 50 points × quantity 2
    expect(card.sessionId).toBe(SESSION);
    expect(card.issuedByUserId).toBe(ACTOR.userId);
  });

  it("refuses to rewrite the stamped value (server-owned field)", async () => {
    const card = await issueCard();

    await expect(
      withTenant(TENANT, (tx) =>
        tx
          .update(hasanatDistributions)
          .set({ pointsSnapshot: 9_999 })
          .where(eq(hasanatDistributions.id, card.id)),
      ),
    ).rejects.toThrow(/immutable/i);

    // The documented escape hatch is the only way, and it is not used by the app.
    await withTenant(TENANT, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_card_value_rewrite = 'true'`);
      await tx
        .update(hasanatDistributions)
        .set({ pointsSnapshot: 9_999 })
        .where(eq(hasanatDistributions.id, card.id));
    });
  });
});

describe("hasanat ledger invariants", () => {
  it("writes one redemption, rejects edits, and corrects through a reversal", async () => {
    const card = await issueCard();
    const { redemption } = await redeemHasanatCard(
      TENANT,
      card.id,
      { reward: "Book", pointsUsed: 100, date: ISSUED_DATE },
      ACTOR,
      hasanatRepository,
    );

    await expect(
      withTenant(TENANT, (tx) =>
        tx
          .update(hasanatRedemptions)
          .set({ pointsUsed: 1 })
          .where(eq(hasanatRedemptions.id, redemption.id)),
      ),
    ).rejects.toThrow(/append-only/i);

    await expect(
      withTenant(TENANT, (tx) =>
        tx.delete(hasanatRedemptions).where(eq(hasanatRedemptions.id, redemption.id)),
      ),
    ).rejects.toThrow(/append-only|hard delete|prohibit/i);

    const { redemption: reversal } = await voidHasanatRedemption(
      TENANT,
      redemption.id,
      { reason: "wrong reward" },
      ACTOR,
      hasanatRepository,
    );
    expect(reversal.kind).toBe("reversal");
    expect(reversal.reversalOfId).toBe(redemption.id);
  });
});

describe("hasanat soft-delete lifecycle", () => {
  it("hides an archived card, refuses a hard delete, and restores it", async () => {
    const card = await issueCard();
    const activeBefore = await listDistributionsPage(TENANT, { includeDeleted: false });

    const deleted = await bulkSoftDeleteDistributions(TENANT, [card.id], ACTOR.userId, "typo");
    expect(deleted.succeeded).toBe(1);

    const active = await listDistributionsPage(TENANT, { includeDeleted: false });
    const trash = await listDistributionsPage(TENANT, { includeDeleted: true });
    expect(active.distributions.some((row) => row.id === card.id)).toBe(false);
    expect(trash.distributions.some((row) => row.id === card.id)).toBe(true);
    expect(active.total).toBe(activeBefore.total - 1);

    await expect(
      withTenant(TENANT, (tx) =>
        tx.delete(hasanatDistributions).where(eq(hasanatDistributions.id, card.id)),
      ),
    ).rejects.toThrow();

    const restored = await bulkRestoreDistributions(TENANT, [card.id], ACTOR.userId);
    expect(restored.succeeded).toBe(1);
    const after = await listDistributionsPage(TENANT, { includeDeleted: false });
    expect(after.distributions.some((row) => row.id === card.id)).toBe(true);
  });
});

describe("hasanat parent archival behaviour", () => {
  it("keeps the card as evidence when its student is purged", async () => {
    const card = await issueCard();

    await withTenant(TENANT, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx.delete(students).where(eq(students.id, STUDENT));
    });

    const rows = await withTenant(TENANT, (tx) =>
      tx
        .select({
          id: hasanatDistributions.id,
          studentId: hasanatDistributions.recipientStudentId,
          points: hasanatDistributions.pointsSnapshot,
        })
        .from(hasanatDistributions)
        .where(eq(hasanatDistributions.id, card.id)),
    );
    expect(rows).toHaveLength(1);
    // SET NULL, not CASCADE: the award history must survive the person record.
    expect(rows[0]?.studentId).toBeNull();
    expect(rows[0]?.points).toBe(100);
  });

  it("refuses to delete a session that still owns cards", async () => {
    await issueCard(STUDENT_2);

    await expect(
      withTenant(TENANT, async (tx) => {
        await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
        await tx.delete(sessions).where(eq(sessions.id, SESSION));
      }),
    ).rejects.toThrow(/foreign key|violates|restrict/i);
  });

  it("purges every hasanat row with the workspace", async () => {
    await issueCard(STUDENT_2);

    await purge();

    const left = await withGlobalTenant((tx) =>
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(hasanatDistributions)
        .where(eq(hasanatDistributions.workspaceSubdomain, TENANT)),
    );
    expect(Number(left[0]?.count ?? 0)).toBe(0);
  });
});

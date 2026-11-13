import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { contacts, workspaces } from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { workshopsUseCases } from "../../workshops/use-cases/workshopsUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Seat-capacity concurrency, against real Postgres.
 *
 * The seat check is a read-modify-write (`count(*)` then `INSERT`) whose mutex is the
 * `workshop_events` row lock (`SELECT … FOR UPDATE`). A single-threaded test cannot prove the lock
 * exists, so these suites fire every writer at the same time and assert the invariant holds no
 * matter which one wins. `scripts/ci/run-concurrency-suite.mjs` repeats them.
 */

const TENANT = `ws-seats-${randomUUID().slice(0, 8)}`;
const CONTACTS = Array.from({ length: 12 }, (_, index) => `seat-contact-${index}`);

const inTenant = <T>(fn: () => Promise<T>) => runWithTenant(TENANT, fn);

async function purge(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await withTenant(TENANT, async (tx) => {
    await tx.insert(workspaces).values({
      id: TENANT,
      subdomain: TENANT,
      madrasaName: "Workshop seat concurrency",
      enabled: true,
    });
    await tx.insert(contacts).values(
      CONTACTS.map((id) => ({
        id,
        workspaceSubdomain: TENANT,
        firstName: id,
        name: `Contact ${id}`,
      })),
    );
  });
});

afterAll(async () => {
  try {
    await purge();
  } finally {
    await closeDatabase();
  }
});

async function createWorkshop(
  id: string,
  capacity: number | null,
  overrides: { startDate?: string; endDate?: string } = {},
): Promise<void> {
  await inTenant(() =>
    workshopsUseCases.createWorkshop({
      id,
      title: `Concurrency ${id}`,
      description: "",
      startDate: "2099-05-01",
      endDate: "2099-05-02",
      capacity,
      ...overrides,
    }),
  );
}

describe("workshop seat capacity (real Postgres)", () => {
  it("never sells more seats than the capacity under concurrent registration", async () => {
    // Arrange
    await createWorkshop("ws-seats", 3);
    const contenders = CONTACTS.slice(0, 8);

    // Act
    const results = await Promise.allSettled(
      contenders.map((contactId) =>
        inTenant(() => workshopsUseCases.addParticipant("ws-seats", contactId)),
      ),
    );

    // Assert — exactly three win and the rest get a domain conflict, not a database error.
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    expect(fulfilled).toHaveLength(3);
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected).toHaveLength(5);
    for (const result of rejected) {
      expect(result.reason).toBeInstanceOf(ConflictError);
    }

    const detail = await inTenant(() => workshopsUseCases.getWorkshop("ws-seats"));
    expect(detail.participants).toHaveLength(3);
    expect(detail.workshop.participantCount).toBe(3);
  });

  it("sells exactly one final remaining seat when many contenders race for it", async () => {
    // Arrange — capacity two, one already seated; the remaining seat is the contested resource.
    await createWorkshop("ws-last-seat", 2);
    await inTenant(() => workshopsUseCases.addParticipant("ws-last-seat", CONTACTS[0]!));

    // Act
    const results = await Promise.allSettled(
      CONTACTS.slice(1, 7).map((contactId) =>
        inTenant(() => workshopsUseCases.addParticipant("ws-last-seat", contactId)),
      ),
    );

    // Assert — exactly one registration takes the final seat; every loser is a typed conflict.
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    for (const result of results) {
      if (result.status === "rejected") expect(result.reason).toBeInstanceOf(ConflictError);
    }
    const detail = await inTenant(() => workshopsUseCases.getWorkshop("ws-last-seat"));
    expect(detail.workshop.participantCount).toBe(2);
    expect(detail.participants).toHaveLength(2);
  });

  it("keeps the invariant when a batch and a single registration race for the last seat", async () => {
    // Arrange — one seat left; an atomic three-contact batch races one single registration.
    await createWorkshop("ws-batch-race", 2);
    await inTenant(() => workshopsUseCases.addParticipant("ws-batch-race", CONTACTS[0]!));

    // Act
    const [batch, single] = await Promise.allSettled([
      inTenant(() =>
        workshopsUseCases.addParticipants("ws-batch-race", [
          CONTACTS[1]!,
          CONTACTS[2]!,
          CONTACTS[3]!,
        ]),
      ),
      inTenant(() => workshopsUseCases.addParticipant("ws-batch-race", CONTACTS[4]!)),
    ]);

    // Assert — the batch cannot partially fill; the single writer may win, and capacity holds.
    expect(batch.status).toBe("rejected");
    expect((batch as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
    if (single.status === "rejected") expect(single.reason).toBeInstanceOf(ConflictError);
    const detail = await inTenant(() => workshopsUseCases.getWorkshop("ws-batch-race"));
    expect(detail.workshop.participantCount).toBeLessThanOrEqual(2);
    expect(detail.participants).toHaveLength(detail.workshop.participantCount);
  });

  it("registers a contact exactly once when two devices submit it together", async () => {
    // Arrange
    await createWorkshop("ws-duplicate", null);

    // Act
    const results = await Promise.allSettled([
      inTenant(() => workshopsUseCases.addParticipant("ws-duplicate", CONTACTS[0]!)),
      inTenant(() => workshopsUseCases.addParticipant("ws-duplicate", CONTACTS[0]!)),
    ]);

    // Assert
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected?.reason).toBeInstanceOf(ConflictError);
    const detail = await inTenant(() => workshopsUseCases.getWorkshop("ws-duplicate"));
    expect(detail.participants).toHaveLength(1);
  });

  it("keeps the seat count at or below the capacity when it is lowered during registration", async () => {
    // Arrange
    await createWorkshop("ws-race", 4);

    // Act — six registrations race an administrator lowering the cap to two.
    const results = await Promise.allSettled([
      ...CONTACTS.slice(0, 6).map((contactId) =>
        inTenant(() => workshopsUseCases.addParticipant("ws-race", contactId)),
      ),
      inTenant(() => workshopsUseCases.updateWorkshop("ws-race", { capacity: 2 })),
    ]);

    // Assert — the invariant is what matters: the workshop never ends up over capacity, and no
    // writer observes a raw database error (lock timeout / deadlock / check violation).
    const detail = await inTenant(() => workshopsUseCases.getWorkshop("ws-race"));
    const capacity = detail.workshop.capacity;
    expect(capacity).not.toBeNull();
    expect(detail.workshop.participantCount).toBeLessThanOrEqual(capacity!);
    for (const result of results) {
      if (result.status === "rejected") expect(result.reason).toBeInstanceOf(ConflictError);
    }
  });

  it("serializes a cancellation against an in-flight registration and leaves no live seat", async () => {
    // Arrange
    await createWorkshop("ws-cancel-race", null);
    const current = await inTenant(() => workshopsUseCases.getWorkshop("ws-cancel-race"));

    // Act
    const [registration, cancel] = await Promise.allSettled([
      inTenant(() => workshopsUseCases.addParticipant("ws-cancel-race", CONTACTS[2]!)),
      inTenant(() =>
        workshopsUseCases.transitionWorkshop(
          "ws-cancel-race",
          { to: "cancelled", reason: "Venue closed" },
          { id: "u-admin" },
          current.workshop.updatedAt,
        ),
      ),
    ]);

    // Assert — the cancel always commits. A registration that committed first is archived by it;
    // one that arrived after it fails closed. Either way no live participant survives.
    expect(cancel.status).toBe("fulfilled");
    if (registration.status === "rejected") {
      expect(registration.reason).toBeInstanceOf(ConflictError);
    }
    const after = await inTenant(() => workshopsUseCases.getWorkshop("ws-cancel-race"));
    expect(after.workshop.status).toBe("cancelled");
    expect(after.participants).toHaveLength(0);
  });

  it("lets exactly one of two concurrent lifecycle transitions win the OCC race", async () => {
    // Arrange — a finished workshop, so both `completed` and `cancelled` are legal targets.
    await createWorkshop("ws-transition-race", null, {
      startDate: "2000-01-01",
      endDate: "2000-01-02",
    });
    const current = await inTenant(() => workshopsUseCases.getWorkshop("ws-transition-race"));
    const token = current.workshop.updatedAt!;

    // Act
    const results = await Promise.allSettled([
      inTenant(() =>
        workshopsUseCases.transitionWorkshop(
          "ws-transition-race",
          { to: "cancelled", reason: "Venue closed" },
          { id: "u-admin" },
          token,
        ),
      ),
      inTenant(() =>
        workshopsUseCases.transitionWorkshop(
          "ws-transition-race",
          { to: "completed" },
          { id: "u-admin" },
          token,
        ),
      ),
    ]);

    // Assert — one commit, one stale conflict; the final state is whichever won.
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(ConflictError);
    expect((rejected[0]!.reason as ConflictError).type).toBe("stale_workshop");
    const after = await inTenant(() => workshopsUseCases.getWorkshop("ws-transition-race"));
    expect(["cancelled", "completed"]).toContain(after.workshop.status);
  });

  it("cannot land a registration under a workshop that is archived at the same time", async () => {
    // Arrange
    await createWorkshop("ws-trash-race", null);

    // Act
    const [registration, trash] = await Promise.allSettled([
      inTenant(() => workshopsUseCases.addParticipant("ws-trash-race", CONTACTS[1]!)),
      inTenant(() => workshopsUseCases.deleteWorkshops(["ws-trash-race"], "u-admin", null)),
    ]);

    // Assert — the archive always wins its own transaction; the registration either committed
    // first or saw the archived row and failed closed (404), never both / never a 500.
    expect(trash.status).toBe("fulfilled");
    if (registration.status === "rejected") {
      expect(registration.reason).toBeInstanceOf(NotFoundError);
    }
    const detail = await inTenant(() => workshopsUseCases.getWorkshop("ws-trash-race"));
    expect(detail.workshop.deletedAt).toBeTruthy();
    expect(detail.participants.length).toBeLessThanOrEqual(1);
  });
});

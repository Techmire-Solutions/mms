import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import { contacts, workspaces } from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { ConflictError, ValidationError } from "../../lib/httpErrors.js";
import { workshopsUseCases } from "../../workshops/use-cases/workshopsUseCases.js";
import { workshopsCompletionUseCases } from "../../workshops/use-cases/workshopsCompletionUseCases.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = `ws-waitlist-${randomUUID().slice(0, 8)}`;
const CONTACTS = Array.from({ length: 10 }, (_, index) => `wl-${index}`);
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
      madrasaName: "Workshop waitlist",
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
  options: {
    capacity: number | null;
    waitlistEnabled?: boolean;
    startDate?: string;
    endDate?: string;
  },
): Promise<void> {
  await inTenant(() =>
    workshopsUseCases.createWorkshop({
      id,
      title: id,
      description: "",
      startDate: options.startDate ?? "2099-03-01",
      endDate: options.endDate ?? "2099-03-02",
      capacity: options.capacity,
      waitlistEnabled: options.waitlistEnabled ?? false,
    }),
  );
}

async function detail(id: string) {
  return inTenant(() => workshopsUseCases.getWorkshop(id));
}

async function add(id: string, contactId: string) {
  return inTenant(() => workshopsUseCases.addParticipant(id, contactId));
}

async function withdraw(id: string, participantId: string) {
  return inTenant(() => workshopsUseCases.removeParticipant(id, participantId, "u-admin"));
}

describe("workshop waitlist (real Postgres)", () => {
  it("keeps refusing a full workshop when the waitlist is disabled", async () => {
    await createWorkshop("wl-off", { capacity: 1 });
    await add("wl-off", CONTACTS[0]!);
    await expect(add("wl-off", CONTACTS[1]!)).rejects.toMatchObject({ type: "capacity_full" });
  });

  it("queues a registration when the workshop is full and the waitlist is enabled", async () => {
    await createWorkshop("wl-on", { capacity: 1, waitlistEnabled: true });
    await add("wl-on", CONTACTS[0]!);
    const queued = await add("wl-on", CONTACTS[1]!);

    expect(queued.waitlistedAt).toBeTruthy();
    const after = await detail("wl-on");
    expect(after.participants).toHaveLength(1);
    expect(after.waitlisted.map((row) => row.contactId)).toEqual([CONTACTS[1]]);
    expect(after.waitlistCount).toBe(1);

    // Queued rows are not participants: no completion standing, no certificate eligibility.
    const rows = await inTenant(() => workshopsCompletionUseCases.getCompletion("wl-on"));
    expect(rows.map((row) => row.participantId)).not.toContain(queued.id);
  });

  it("promotes the oldest queued participant into a freed seat", async () => {
    await createWorkshop("wl-promote", { capacity: 1, waitlistEnabled: true });
    const seated = await add("wl-promote", CONTACTS[0]!);
    const firstQueued = await add("wl-promote", CONTACTS[1]!);
    const secondQueued = await add("wl-promote", CONTACTS[2]!);

    const promoted = await withdraw("wl-promote", seated.id);

    expect(promoted?.id).toBe(firstQueued.id);
    expect(promoted?.waitlistedAt).toBeNull();
    const after = await detail("wl-promote");
    expect(after.participants.map((row) => row.id)).toEqual([firstQueued.id]);
    expect(after.waitlisted.map((row) => row.id)).toEqual([secondQueued.id]);
  });

  it("promotes nobody when a queued row is withdrawn", async () => {
    await createWorkshop("wl-queued-withdraw", { capacity: 1, waitlistEnabled: true });
    const seated = await add("wl-queued-withdraw", CONTACTS[0]!);
    const queued = await add("wl-queued-withdraw", CONTACTS[1]!);

    const promoted = await withdraw("wl-queued-withdraw", queued.id);

    expect(promoted).toBeNull();
    const after = await detail("wl-queued-withdraw");
    expect(after.participants.map((row) => row.id)).toEqual([seated.id]);
    expect(after.waitlisted).toHaveLength(0);
  });

  it("seats exactly the capacity under concurrent registrations and queues the rest", async () => {
    await createWorkshop("wl-race", { capacity: 2, waitlistEnabled: true });
    const results = await Promise.allSettled(
      CONTACTS.slice(0, 5).map((contactId) => add("wl-race", contactId)),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);

    const after = await detail("wl-race");
    expect(after.participants).toHaveLength(2);
    expect(after.waitlisted).toHaveLength(3);
    expect(after.workshop.participantCount).toBe(2);
  });

  it("promotes a distinct participant for each concurrent withdrawal", async () => {
    await createWorkshop("wl-race-withdraw", { capacity: 2, waitlistEnabled: true });
    const [a, b] = await Promise.all([
      add("wl-race-withdraw", CONTACTS[0]!),
      add("wl-race-withdraw", CONTACTS[1]!),
    ]);
    await add("wl-race-withdraw", CONTACTS[2]!);
    await add("wl-race-withdraw", CONTACTS[3]!);

    const results = await Promise.allSettled([
      withdraw("wl-race-withdraw", a.id),
      withdraw("wl-race-withdraw", b.id),
    ]);

    const promoted = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value?.id)
      .filter(Boolean);
    expect(promoted).toHaveLength(2);
    expect(new Set(promoted).size).toBe(2);
    const after = await detail("wl-race-withdraw");
    expect(after.participants).toHaveLength(2);
    expect(after.waitlisted).toHaveLength(0);
    // Promotion kept queue order: the two oldest queued rows took the seats.
    expect(after.participants.map((row) => row.contactId).sort()).toEqual(
      [CONTACTS[2], CONTACTS[3]].sort(),
    );
  });

  it("does not overbook when a withdrawal and a new registration race", async () => {
    await createWorkshop("wl-race-promote", { capacity: 1, waitlistEnabled: true });
    const seated = await add("wl-race-promote", CONTACTS[0]!);
    const queued = await add("wl-race-promote", CONTACTS[1]!);

    const [withdrawal, newcomer] = await Promise.allSettled([
      withdraw("wl-race-promote", seated.id),
      add("wl-race-promote", CONTACTS[2]!),
    ]);

    // Both requests are valid: the newcomer either takes the freed seat or joins the queue, while
    // the withdrawal always promotes the oldest queued row under the same lock.
    expect(withdrawal.status).toBe("fulfilled");
    expect(newcomer.status).toBe("fulfilled");
    const after = await detail("wl-race-promote");
    expect(after.participants).toHaveLength(1);
    expect(after.participants[0]?.contactId).toBe(queued.contactId);
    expect(after.waitlisted.map((row) => row.contactId)).toEqual([CONTACTS[2]]);
    expect(after.workshop.participantCount).toBe(1);
  });

  it("promotes up to the freed seats when the capacity is raised", async () => {
    await createWorkshop("wl-capacity", { capacity: 1, waitlistEnabled: true });
    await add("wl-capacity", CONTACTS[0]!);
    await add("wl-capacity", CONTACTS[1]!);
    await add("wl-capacity", CONTACTS[2]!);
    await add("wl-capacity", CONTACTS[3]!);

    await inTenant(() => workshopsUseCases.updateWorkshop("wl-capacity", { capacity: 3 }));

    const after = await detail("wl-capacity");
    expect(after.participants).toHaveLength(3);
    expect(after.participants.map((row) => row.contactId).sort()).toEqual(
      [CONTACTS[0], CONTACTS[1], CONTACTS[2]].sort(),
    );
    expect(after.waitlisted.map((row) => row.contactId)).toEqual([CONTACTS[3]]);
  });

  it("does not promote once the workshop's last day has passed", async () => {
    await createWorkshop("wl-ended", {
      capacity: 1,
      waitlistEnabled: true,
      startDate: "2099-06-01",
      endDate: "2099-06-02",
    });
    const seated = await add("wl-ended", CONTACTS[0]!);
    const queued = await add("wl-ended", CONTACTS[1]!);
    // Move the workshop into the past while it is still open (allowed for structural edits).
    await inTenant(() =>
      workshopsUseCases.updateWorkshop("wl-ended", {
        startDate: "2000-01-01",
        endDate: "2000-01-02",
      }),
    );

    const promoted = await withdraw("wl-ended", seated.id);

    expect(promoted).toBeNull();
    const after = await detail("wl-ended");
    expect(after.participants).toHaveLength(0);
    expect(after.waitlisted.map((row) => row.id)).toEqual([queued.id]);
  });

  it("skips a queued contact that was archived after joining", async () => {
    await createWorkshop("wl-archived-contact", { capacity: 1, waitlistEnabled: true });
    const seated = await add("wl-archived-contact", CONTACTS[6]!);
    await add("wl-archived-contact", CONTACTS[7]!);
    const live = await add("wl-archived-contact", CONTACTS[8]!);
    // CONTACTS[7] is archived for the rest of the suite; later tests only use 0–3.
    await withTenant(TENANT, (tx) =>
      tx
        .update(contacts)
        .set({ deletedAt: new Date() })
        .where(and(eq(contacts.workspaceSubdomain, TENANT), eq(contacts.id, CONTACTS[7]!))),
    );

    const promoted = await withdraw("wl-archived-contact", seated.id);

    expect(promoted?.id).toBe(live.id);
  });

  it("refuses check-ins and scores for queued rows and archives them with the workshop", async () => {
    await createWorkshop("wl-lifecycle", { capacity: 1, waitlistEnabled: true });
    await add("wl-lifecycle", CONTACTS[0]!);
    const queued = await add("wl-lifecycle", CONTACTS[1]!);

    await expect(
      inTenant(() =>
        workshopsUseCases.saveAttendanceDay(
          "wl-lifecycle",
          { dayOn: "2099-03-01", marks: [{ participantId: queued.id, status: "present" }] },
          "u-admin",
        ),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      inTenant(() =>
        workshopsUseCases.saveScores("wl-lifecycle", {
          scores: [
            { participantId: queued.id, criterionName: "Practical", score: 5, maxScore: 10 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    const current = await detail("wl-lifecycle");
    await inTenant(() =>
      workshopsUseCases.transitionWorkshop(
        "wl-lifecycle",
        { to: "cancelled", reason: "Venue unavailable" },
        { id: "u-admin" },
        current.workshop.updatedAt,
      ),
    );
    const after = await detail("wl-lifecycle");
    expect(after.participants).toHaveLength(0);
    expect(after.waitlisted).toHaveLength(0);
    await expect(add("wl-lifecycle", CONTACTS[3]!)).rejects.toMatchObject({
      type: "workshop_not_open",
    });
  });

  it("registers a batch atomically, filling seats in input order and queueing the overflow", async () => {
    await createWorkshop("wl-batch", { capacity: 2, waitlistEnabled: true });
    const result = await inTenant(() =>
      workshopsUseCases.addParticipants("wl-batch", [
        CONTACTS[0]!,
        CONTACTS[1]!,
        CONTACTS[2]!,
        CONTACTS[3]!,
      ]),
    );

    expect(result.added.map((row) => row.contactId)).toEqual([CONTACTS[0], CONTACTS[1]]);
    expect(result.waitlisted.map((row) => row.contactId)).toEqual([CONTACTS[2], CONTACTS[3]]);
    const after = await detail("wl-batch");
    expect(after.participants).toHaveLength(2);
    expect(after.waitlisted).toHaveLength(2);
  });

  it("rejects a batch that overflows a workshop without a waitlist, writing nothing", async () => {
    await createWorkshop("wl-batch-off", { capacity: 1 });
    await expect(
      inTenant(() =>
        workshopsUseCases.addParticipants("wl-batch-off", [CONTACTS[0]!, CONTACTS[1]!]),
      ),
    ).rejects.toMatchObject({ type: "capacity_full" });
    expect((await detail("wl-batch-off")).participants).toHaveLength(0);
  });

  it("rejects a batch with a repeated or already-registered contact", async () => {
    await createWorkshop("wl-batch-dup", { capacity: 3, waitlistEnabled: true });
    await expect(
      inTenant(() =>
        workshopsUseCases.addParticipants("wl-batch-dup", [CONTACTS[0]!, CONTACTS[0]!]),
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    await add("wl-batch-dup", CONTACTS[0]!);
    await expect(
      inTenant(() =>
        workshopsUseCases.addParticipants("wl-batch-dup", [CONTACTS[0]!, CONTACTS[1]!]),
      ),
    ).rejects.toMatchObject({ type: "already_registered" });
    expect((await detail("wl-batch-dup")).participants).toHaveLength(1);
  });
});

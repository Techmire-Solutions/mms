import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDatabase } from "@mms/db/client";
import { applyDrizzleMigrations } from "@mms/db/migrations";
import { withTenant } from "@mms/db/context";
import { contacts, workshopAttendance, workshopParticipants, workspaces } from "@mms/db/schema";
import { runWithTenant } from "../../lib/tenantContext.js";
import { workshopsUseCases } from "@mms/mod-workshops/backend/use-cases";
import { workshopsCompletionUseCases } from "@mms/mod-workshops/backend/use-cases";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Completion/certificate races, against real Postgres.
 *
 * Evaluation and issuance both take the workshop row lock, so two requests cannot interleave a
 * read-modify-write. These tests assert one-winner/idempotent outcomes, never timing.
 */
const TENANT = `ws-completion-race-${randomUUID().slice(0, 8)}`;
const CONTACTS = Array.from({ length: 10 }, (_, index) => `cc-${index}`);
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
      madrasaName: "Workshop completion concurrency",
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

async function seedWorkshop(id: string, contactIds: string[]): Promise<string[]> {
  await inTenant(() =>
    workshopsUseCases.createWorkshop({
      id,
      title: `Completion race ${id}`,
      description: "",
      startDate: "2000-01-01",
      endDate: "2000-01-02",
      capacity: 20,
    }),
  );
  const participantIds = contactIds.map((_, index) => `${id}-p${index}`);
  await withTenant(TENANT, (tx) =>
    tx.insert(workshopParticipants).values(
      participantIds.map((participantId, index) => ({
        id: participantId,
        workspaceSubdomain: TENANT,
        workshopId: id,
        contactId: contactIds[index]!,
        status: "registered" as const,
      })),
    ),
  );
  await inTenant(() =>
    workshopsUseCases.saveAttendanceDay(
      id,
      {
        dayOn: "2000-01-01",
        marks: participantIds.map((participantId) => ({
          participantId,
          status: "present" as const,
        })),
      },
      null,
    ),
  );
  await inTenant(() =>
    workshopsUseCases.saveAttendanceDay(
      id,
      {
        dayOn: "2000-01-02",
        marks: participantIds.map((participantId) => ({
          participantId,
          status: "present" as const,
        })),
      },
      null,
    ),
  );
  return participantIds;
}

describe("workshop completion concurrency (real Postgres)", () => {
  it("lets two concurrent evaluations settle on one coherent standing", async () => {
    const participantIds = await seedWorkshop("race-evaluate", CONTACTS.slice(0, 3));
    const results = await Promise.allSettled([
      inTenant(() => workshopsCompletionUseCases.evaluateCompletion("race-evaluate")),
      inTenant(() => workshopsCompletionUseCases.evaluateCompletion("race-evaluate")),
    ]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);

    const rows = await inTenant(() => workshopsCompletionUseCases.getCompletion("race-evaluate"));
    expect(rows.map((row: any) => row.participantId).sort()).toEqual([...participantIds].sort());
    expect(rows.every((row: any) => row.status === "completed")).toBe(true);
    expect(new Set(rows.map((row: any) => row.completedAt)).size).toBe(1);
  });

  it("certifies each completed participant exactly once under concurrent issue requests", async () => {
    const participantIds = await seedWorkshop("race-issue", CONTACTS.slice(3, 6));
    const first = await inTenant(() =>
      workshopsCompletionUseCases.evaluateCompletion("race-issue"),
    );
    expect(first.every((row: any) => row.status === "completed")).toBe(true);

    const results = await Promise.all([
      inTenant(() =>
        workshopsCompletionUseCases.issueCertificates("race-issue", { participantIds: [] }),
      ),
      inTenant(() =>
        workshopsCompletionUseCases.issueCertificates("race-issue", { participantIds: [] }),
      ),
    ]);
    const issued = results.flatMap((result) => result.issued);
    expect(issued.sort()).toEqual([...participantIds].sort());
    expect(new Set(issued).size).toBe(issued.length);

    const rows = await inTenant(() => workshopsCompletionUseCases.getCompletion("race-issue"));
    expect(rows.every((row: any) => row.certificateIssuedAt !== null)).toBe(true);
  });

  it("completes the workshop while certificates are issued without a lost update", async () => {
    await seedWorkshop("race-complete-issue", CONTACTS.slice(6, 8));
    await inTenant(() => workshopsCompletionUseCases.evaluateCompletion("race-complete-issue"));
    const detail = await inTenant(() => workshopsUseCases.getWorkshop("race-complete-issue"));

    const [transition, issue] = await Promise.allSettled([
      inTenant(() =>
        workshopsUseCases.transitionWorkshop(
          "race-complete-issue",
          { to: "completed" },
          { id: "u-admin" },
          detail.workshop.updatedAt,
        ),
      ),
      inTenant(() =>
        workshopsCompletionUseCases.issueCertificates("race-complete-issue", {
          participantIds: [],
        }),
      ),
    ]);
    expect(transition.status).toBe("fulfilled");
    expect(issue.status).toBe("fulfilled");
    const after = await inTenant(() => workshopsUseCases.getWorkshop("race-complete-issue"));
    expect(after.workshop.status).toBe("completed");
    const rows = await inTenant(() =>
      workshopsCompletionUseCases.getCompletion("race-complete-issue"),
    );
    expect(rows.every((row: any) => row.certificateIssuedAt !== null)).toBe(true);
  });

  it("serializes an attendance save against evaluation and keeps the committed mark", async () => {
    const participantIds = await seedWorkshop("race-attendance", CONTACTS.slice(8, 10));
    // Remove the second day's marks so an attendance save is a real edit.
    await withTenant(TENANT, (tx) =>
      tx.delete(workshopAttendance).where(eq(workshopAttendance.workshopId, "race-attendance")),
    );
    const [attendance, evaluation] = await Promise.allSettled([
      inTenant(() =>
        workshopsUseCases.saveAttendanceDay(
          "race-attendance",
          {
            dayOn: "2000-01-01",
            marks: participantIds.map((participantId) => ({
              participantId,
              status: "present" as const,
            })),
          },
          null,
        ),
      ),
      inTenant(() => workshopsCompletionUseCases.evaluateCompletion("race-attendance")),
    ]);
    expect(attendance.status).toBe("fulfilled");
    expect(evaluation.status).toBe("fulfilled");

    // Re-evaluate after both writers; the committed attendance must be visible and countable.
    const rows = await inTenant(() =>
      workshopsCompletionUseCases.evaluateCompletion("race-attendance"),
    );
    expect(rows.every((row: any) => row.status === "completed")).toBe(true);
  });

  it("cancels while evaluation races and leaves no live participant or certificate", async () => {
    await seedWorkshop("race-cancel", CONTACTS.slice(0, 2));
    const detail = await inTenant(() => workshopsUseCases.getWorkshop("race-cancel"));
    const [cancel, evaluation] = await Promise.allSettled([
      inTenant(() =>
        workshopsUseCases.transitionWorkshop(
          "race-cancel",
          { to: "cancelled", reason: "Venue closed" },
          { id: "u-admin" },
          detail.workshop.updatedAt,
        ),
      ),
      inTenant(() => workshopsCompletionUseCases.evaluateCompletion("race-cancel")),
    ]);
    expect(cancel.status).toBe("fulfilled");
    if (evaluation.status === "rejected") {
      expect(evaluation.reason).toBeTruthy();
    }
    const after = await inTenant(() => workshopsUseCases.getWorkshop("race-cancel"));
    expect(after.workshop.status).toBe("cancelled");
    expect(after.participants).toHaveLength(0);
    const rows = await inTenant(() => workshopsCompletionUseCases.getCompletion("race-cancel"));
    expect(rows.filter((row: any) => row.certificateIssuedAt !== null)).toHaveLength(0);
  });
});

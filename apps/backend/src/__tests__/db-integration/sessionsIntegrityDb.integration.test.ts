import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SessionSchema } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  enrollments,
  sessionClasses,
  sessions,
  students,
  workspaces,
} from "../../db/schema.js";
import {
  replaceSessionsForWorkspace,
  saveSession,
  softDeleteSessionWithCascade,
} from "../../db/repositories/sessionRepositoryPersist.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

/**
 * Migration 0206 invariants against real PostgreSQL: the tenant-scoped no-overlap exclusion, the
 * monotonic OCC token, class domain checks, the enrollment FK hardening and the restore replace.
 */
const TENANT = "sessions-integrity-0206";

function record(id: string, overrides: Record<string, unknown> = {}) {
  return SessionSchema.parse({
    id,
    name: `Session ${id}`,
    status: "draft",
    startDate: "2026-01-01",
    endDate: "2026-06-30",
    baseFee: 100,
    ...overrides,
  });
}

async function purgeTenant(): Promise<void> {
  await withTenant(TENANT, async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.delete(workspaces).where(eq(workspaces.subdomain, TENANT));
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purgeTenant();
  await withTenant(TENANT, async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "Sessions integrity", enabled: true });
    await tx.insert(students).values({
      id: "si-student-1",
      workspaceSubdomain: TENANT,
      grNumber: "gr-si-1",
      status: "active",
    });
  });
});

afterAll(async () => {
  await purgeTenant();
  await closeDatabase();
});

describe("sessions_no_overlap_excl (migration 0206)", () => {
  it("rejects a live session whose inclusive range overlaps another live session", async () => {
    // Arrange
    await saveSession(TENANT, record("ov-a", { startDate: "2027-01-01", endDate: "2027-06-30" }));

    // Act
    const act = saveSession(
      TENANT,
      record("ov-b", { startDate: "2027-06-30", endDate: "2027-12-31" }),
    );

    // Assert — the boundary day is inclusive, so this is a real overlap.
    await expect(act).rejects.toThrow(ConflictError);
    await expect(act).rejects.toThrow(/overlap another live session/i);
  });

  it("allows back-to-back ranges on adjacent days", async () => {
    // Arrange
    await saveSession(TENANT, record("adj-a", { startDate: "2028-01-01", endDate: "2028-06-30" }));

    // Act / Assert
    await expect(
      saveSession(TENANT, record("adj-b", { startDate: "2028-07-01", endDate: "2028-12-31" })),
    ).resolves.toBeTruthy();
  });

  it("allows an overlap once the earlier session is archived", async () => {
    // Arrange
    await saveSession(TENANT, record("arch-a", { startDate: "2029-01-01", endDate: "2029-06-30" }));
    await softDeleteSessionWithCascade(TENANT, "arch-a", "u-test", "test archive");

    // Act / Assert
    await expect(
      saveSession(TENANT, record("arch-b", { startDate: "2029-03-01", endDate: "2029-08-31" })),
    ).resolves.toBeTruthy();
  });

  it("allows overlapping history for a completed session", async () => {
    // Arrange
    await saveSession(
      TENANT,
      record("done-a", { status: "completed", startDate: "2030-01-01", endDate: "2030-06-30" }),
    );

    // Act / Assert
    await expect(
      saveSession(TENANT, record("done-b", { startDate: "2030-03-01", endDate: "2030-08-31" })),
    ).resolves.toBeTruthy();
  });

  it("allows an overlap for a row flagged overlap_exempt (allowOverlap preference)", async () => {
    // Arrange
    await saveSession(TENANT, record("ex-a", { startDate: "2031-01-01", endDate: "2031-06-30" }));

    // Act / Assert
    await expect(
      saveSession(
        TENANT,
        record("ex-b", { startDate: "2031-03-01", endDate: "2031-08-31", overlapExempt: true }),
      ),
    ).resolves.toBeTruthy();
  });
});

describe("sessions OCC token (migration 0206)", () => {
  it("rejects a stale version and accepts the current one", async () => {
    // Arrange
    await saveSession(TENANT, record("occ-1", { startDate: "2035-06-01", endDate: "2035-07-31" }));
    const created = await findSessionById(TENANT, "occ-1");
    expect(created?.version).toBe(1);

    // Act
    const stale = saveSession(
      TENANT,
      record("occ-1", { name: "Renamed", startDate: "2035-06-01", endDate: "2035-07-31" }),
      { expectedVersion: 0 },
    );

    // Assert
    await expect(stale).rejects.toThrow(ConflictError);
    await expect(
      saveSession(
        TENANT,
        record("occ-1", { name: "Renamed", startDate: "2035-06-01", endDate: "2035-07-31" }),
        { expectedVersion: 1 },
      ),
    ).resolves.toBeTruthy();
    const updated = await findSessionById(TENANT, "occ-1");
    expect(updated?.name).toBe("Renamed");
    expect(updated?.version).toBe(2);
  });

  it("does not resurrect an archived session through a normal upsert", async () => {
    // Arrange
    await saveSession(TENANT, record("keep-archived", { startDate: "2026-07-01", endDate: "2026-08-31" }));
    await softDeleteSessionWithCascade(TENANT, "keep-archived", "u-test", "test archive");

    // Act — the repository path used by imports/bulk sync, without the use-case guard.
    await saveSession(
      TENANT,
      record("keep-archived", {
        name: "Silently revived?",
        startDate: "2026-07-01",
        endDate: "2026-08-31",
      }),
    );

    // Assert
    const archived = await findSessionById(TENANT, "keep-archived");
    expect(archived?.deletedAt).toBeTruthy();
    expect(archived?.restoredAt).toBeFalsy();
  });
});

describe("session_classes domain checks (migration 0206)", () => {
  it("rejects a negative capacity", async () => {
    // Arrange
    await saveSession(TENANT, record("cls-neg", { startDate: "2035-01-01", endDate: "2035-02-28" }));

    // Act
    const act = withTenant(TENANT, async (tx) => {
      await tx.insert(sessionClasses).values({
        id: "cls-neg-1",
        workspaceSubdomain: TENANT,
        sessionId: "cls-neg",
        name: "Negative capacity",
        capacity: -1,
      });
    });

    // Assert
    await expect(act).rejects.toMatchObject({
      cause: { constraint: "session_classes_capacity_check" },
    });
  });

  it("rejects an inverted age range", async () => {
    // Act
    const act = withTenant(TENANT, async (tx) => {
      await tx.insert(sessionClasses).values({
        id: "cls-age-1",
        workspaceSubdomain: TENANT,
        sessionId: "cls-neg",
        name: "Inverted ages",
        ageMin: 12,
        ageMax: 6,
      });
    });

    // Assert
    await expect(act).rejects.toMatchObject({
      cause: { constraint: "session_classes_age_range_check" },
    });
  });
});

describe("enrollments session FK (migration 0206)", () => {
  it("refuses a hard delete that would strand enrollment history", async () => {
    // Arrange
    await saveSession(
      TENANT,
      record("fk-1", {
        startDate: "2032-01-01",
        endDate: "2032-06-30",
        classes: [{ id: "fk-1-class", name: "Class 1" }],
      }),
    );
    await withTenant(TENANT, async (tx) => {
      await tx.insert(enrollments).values({
        id: "fk-1-enrollment",
        workspaceSubdomain: TENANT,
        studentId: "si-student-1",
        sessionId: "fk-1",
        classId: "fk-1-class",
      });
    });

    // Act — the deferred NO ACTION check fires at commit.
    const act = withTenant(TENANT, async (tx) => {
      await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
      await tx.delete(sessions).where(eq(sessions.id, "fk-1"));
    });

    // Assert
    await expect(act).rejects.toThrow();
    expect(await findSessionById(TENANT, "fk-1")).toBeTruthy();
  });
});

describe("replaceSessionsForWorkspace (backup restore)", () => {
  it("archives sessions missing from the backup instead of deleting them", async () => {
    // Arrange
    await saveSession(
      TENANT,
      record("restore-old", {
        startDate: "2033-01-01",
        endDate: "2033-06-30",
        classes: [{ id: "restore-old-class", name: "Class 1" }],
      }),
    );
    await withTenant(TENANT, async (tx) => {
      await tx.insert(enrollments).values({
        id: "restore-old-enrollment",
        workspaceSubdomain: TENANT,
        studentId: "si-student-1",
        sessionId: "restore-old",
        classId: "restore-old-class",
      });
    });

    // Act
    await replaceSessionsForWorkspace(TENANT, [
      record("restore-new", { startDate: "2034-01-01", endDate: "2034-06-30" }),
    ]);

    // Assert — no cascade, no lost enrollment.
    const archived = await findSessionById(TENANT, "restore-old");
    expect(archived?.deletedAt).toBeTruthy();
    const kept = await withTenant(TENANT, async (tx) =>
      tx.select({ id: enrollments.id }).from(enrollments).where(eq(enrollments.id, "restore-old-enrollment")),
    );
    expect(kept).toHaveLength(1);
    expect(await findSessionById(TENANT, "restore-new")).toBeTruthy();
  });
});

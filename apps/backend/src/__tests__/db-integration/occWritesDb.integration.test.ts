import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { User } from "@mms/shared";
import { closeDatabase } from "../../db/dbConnection.js";
import { applyDrizzleMigrations } from "../../db/dbInit.js";
import { withGlobalTenant, withTenant } from "../../db/tenant-context.js";
import { students, tasks, workspaces } from "../../db/schema.js";
import { runWithTenant } from "../../lib/tenantContext.js";
import { ConflictError } from "../../lib/httpErrors.js";
import { updateStudentById } from "../../students/use-cases/studentWriteUseCases.js";
import { updateTask } from "../../db/repositories/tasksWriteRepository.js";
import { requireDatabaseConnection } from "./dbTestSupport.js";

const TENANT = `occ-${randomUUID().slice(0, 8)}`;

const ADMIN = {
  id: "u-admin",
  name: "Admin",
  email: "admin@example.test",
  role: "admin",
  workspaceSubdomain: TENANT,
} as User;

async function purge(): Promise<void> {
  await withGlobalTenant(async (tx) => {
    await tx.execute(sql`SET LOCAL app.allow_hard_purge = 'true'`);
    await tx.execute(sql`DELETE FROM students WHERE workspace_subdomain = ${TENANT}`);
    await tx.execute(sql`DELETE FROM tasks WHERE workspace_subdomain = ${TENANT}`);
    await tx.execute(sql`DELETE FROM workspaces WHERE subdomain = ${TENANT}`);
  });
}

beforeAll(async () => {
  await requireDatabaseConnection();
  await applyDrizzleMigrations();
  await purge();
  await withGlobalTenant(async (tx) => {
    await tx
      .insert(workspaces)
      .values({ id: TENANT, subdomain: TENANT, madrasaName: "OCC probes", enabled: true });
    await tx.insert(students).values({
      id: "s-occ",
      workspaceSubdomain: TENANT,
      grNumber: "GR-OCC",
      status: "active",
      notes: "original",
    });
    await tx.insert(tasks).values({
      id: "t-occ",
      workspaceSubdomain: TENANT,
      title: "Original title",
      status: "todo",
      priority: "medium",
      createdByUserId: ADMIN.id,
    });
  });
});

afterAll(async () => {
  await purge();
  await closeDatabase();
});

async function studentUpdatedAt(): Promise<string> {
  const rows = await withTenant(TENANT, (tx) =>
    tx.select({ updatedAt: students.updatedAt }).from(students).where(eq(students.id, "s-occ")),
  );
  return rows[0].updatedAt.toISOString();
}

async function taskUpdatedAt(): Promise<string> {
  const rows = await withTenant(TENANT, (tx) =>
    tx.select({ updatedAt: tasks.updatedAt }).from(tasks).where(eq(tasks.id, "t-occ")),
  );
  return rows[0].updatedAt.toISOString();
}

describe("Students optimistic concurrency", () => {
  it("rejects a stale token with a 409 conflict and leaves the row unchanged", async () => {
    const stale = new Date(Date.now() - 60_000).toISOString();
    await runWithTenant(TENANT, async () => {
      await expect(
        updateStudentById(
          "s-occ",
          { notes: "stale write" },
          { user: ADMIN, expectedUpdatedAt: stale },
        ),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    const rows = await withTenant(TENANT, (tx) =>
      tx.select({ notes: students.notes }).from(students).where(eq(students.id, "s-occ")),
    );
    expect(rows[0].notes).toBe("original");
  });

  it("accepts the token the client read", async () => {
    const token = await studentUpdatedAt();
    const saved = await runWithTenant(TENANT, () =>
      updateStudentById(
        "s-occ",
        { notes: "fresh write" },
        { user: ADMIN, expectedUpdatedAt: token },
      ),
    );
    expect(saved?.notes).toBe("fresh write");
  });
});

describe("Tasks optimistic concurrency", () => {
  it("rejects a stale token with a 409 conflict and leaves the row unchanged", async () => {
    const stale = new Date(Date.now() - 60_000).toISOString();
    await expect(
      updateTask(TENANT, "t-occ", { title: "stale title" }, undefined, ADMIN.id, stale),
    ).rejects.toBeInstanceOf(ConflictError);

    const rows = await withTenant(TENANT, (tx) =>
      tx.select({ title: tasks.title }).from(tasks).where(eq(tasks.id, "t-occ")),
    );
    expect(rows[0].title).toBe("Original title");
  });

  it("accepts the token the client read", async () => {
    const token = await taskUpdatedAt();
    const updated = await updateTask(
      TENANT,
      "t-occ",
      { title: "Fresh title" },
      undefined,
      ADMIN.id,
      token,
    );
    expect(updated?.title).toBe("Fresh title");
  });
});

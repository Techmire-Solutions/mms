import { describe, expect, it, vi } from "vitest";
import type { BackgroundJobRecord } from "@mms/shared";
import {
  BackgroundJobLimitError,
  countUserBackgroundJobs,
  createDatabaseBackgroundJob,
  dismissUserBackgroundJob,
  findLiveBackgroundJobForEntity,
  getUserBackgroundJob,
  getUserBackgroundJobPayload,
  listUserBackgroundJobs,
  upsertUserBackgroundJob,
} from "../services/backgroundJobService.js";
import * as tenantContext from "../lib/tenantContext.js";
import * as tenantDb from "../db/tenant-context.js";
import * as cleanupRepo from "../db/repositories/backgroundJobCleanupRepository.js";
import * as queryRepo from "../db/repositories/backgroundJobQueryRepository.js";

describe("backgroundJobService unit & coverage suite", () => {
  it("BackgroundJobLimitError initializes correctly", () => {
    const err = new BackgroundJobLimitError(50);
    expect(err.name).toBe("BackgroundJobLimitError");
    expect(err.message).toContain("Too many retained background jobs (limit 50)");
  });

  it("countUserBackgroundJobs returns 0 if no tenant in context", async () => {
    vi.spyOn(tenantContext, "getRequestTenant").mockReturnValueOnce(null);
    const count = await countUserBackgroundJobs("u-1");
    expect(count).toBe(0);
  });

  it("countUserBackgroundJobs calls repository when tenant is present", async () => {
    vi.spyOn(tenantContext, "getRequestTenant").mockReturnValueOnce("demo");
    vi.spyOn(queryRepo, "countBackgroundJobsForUser").mockResolvedValueOnce(5);
    const count = await countUserBackgroundJobs("u-1");
    expect(count).toBe(5);
  });

  it("findLiveBackgroundJobForEntity returns null if no tenant", async () => {
    vi.spyOn(tenantContext, "getRequestTenant").mockReturnValueOnce(null);
    const job = await findLiveBackgroundJobForEntity("contacts", "export", "type", "csv");
    expect(job).toBeNull();
  });

  it("findLiveBackgroundJobForEntity delegates to repository", async () => {
    vi.spyOn(tenantContext, "getRequestTenant").mockReturnValueOnce("demo");
    const mockJob: BackgroundJobRecord = {
      id: "j-live",
      moduleId: "contacts",
      kind: "export",
      status: "running",
      label: "Exporting",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    vi.spyOn(queryRepo, "findLiveBackgroundJob").mockResolvedValueOnce(mockJob);
    const job = await findLiveBackgroundJobForEntity("contacts", "export", "type", "csv");
    expect(job).toEqual(mockJob);
  });

  it("listUserBackgroundJobs returns [] when no tenant in context", async () => {
    vi.spyOn(tenantContext, "getRequestTenant").mockReturnValueOnce(null);
    const jobs = await listUserBackgroundJobs("u-1");
    expect(jobs).toEqual([]);
  });

  it("listUserBackgroundJobs executes with tenant and filters out corrupted rows", async () => {
    vi.spyOn(tenantContext, "getRequestTenant").mockReturnValueOnce("demo");
    vi.spyOn(cleanupRepo, "resolveEffectiveTenantUserId").mockResolvedValueOnce("eff-u-1");

    const mockRows = [
      {
        id: "j-1",
        moduleId: "contacts",
        kind: "export",
        status: "completed",
        label: "Export Contacts",
        progressCurrent: 10,
        progressTotal: 10,
        hasDownload: true,
        error: null,
        errors: null,
        completedAt: new Date("2026-01-01T00:01:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      // Corrupted row that throws inside rowToJobRecord when accessed
      {
        id: "j-corrupt",
        get moduleId(): string {
          throw new Error("corrupt data");
        },
      },
    ];

    const mockTx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValueOnce(mockRows),
    };

    vi.spyOn(tenantDb, "withTenant").mockImplementationOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (_tenant: any, cb: any) => cb(mockTx),
    );

    const jobs = await listUserBackgroundJobs("u-1");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.id).toBe("j-1");
  });

  it("getUserBackgroundJob returns null without tenant", async () => {
    vi.spyOn(tenantContext, "getRequestTenant").mockReturnValueOnce(null);
    const job = await getUserBackgroundJob("u-1", "j-1");
    expect(job).toBeNull();
  });

  it("getUserBackgroundJob returns mapped job or null on missing row", async () => {
    vi.spyOn(tenantContext, "getRequestTenant").mockReturnValueOnce("demo");
    vi.spyOn(cleanupRepo, "resolveEffectiveTenantUserId").mockResolvedValueOnce("eff-u-1");

    const mockTx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValueOnce([]),
    };

    vi.spyOn(tenantDb, "withTenant").mockImplementationOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (_tenant: any, cb: any) => cb(mockTx),
    );

    const job = await getUserBackgroundJob("u-1", "j-not-found");
    expect(job).toBeNull();
  });

  it("upsertUserBackgroundJob throws without tenant", async () => {
    vi.spyOn(tenantContext, "getRequestTenant").mockReturnValueOnce(null);
    const jobRecord: BackgroundJobRecord = {
      id: "j-new",
      moduleId: "contacts",
      kind: "export",
      status: "pending",
      label: "Export",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    await expect(upsertUserBackgroundJob("u-1", jobRecord)).rejects.toThrow(
      "Tenant context is required",
    );
  });

  it("upsertUserBackgroundJob successfully persists with tenant", async () => {
    vi.spyOn(tenantContext, "getRequestTenant").mockReturnValueOnce("demo");
    vi.spyOn(cleanupRepo, "resolveEffectiveTenantUserId").mockResolvedValueOnce("eff-u-1");

    const mockTx = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValueOnce(undefined),
    };

    vi.spyOn(tenantDb, "withTenant").mockImplementationOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (_tenant: any, cb: any) => cb(mockTx),
    );

    const jobRecord: BackgroundJobRecord = {
      id: "j-upsert",
      moduleId: "contacts",
      kind: "export",
      status: "completed",
      label: "Export",
      completedAt: "2026-01-01T00:01:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const result = await upsertUserBackgroundJob("u-1", jobRecord);
    expect(result.id).toBe("j-upsert");
  });

  it("createDatabaseBackgroundJob inserts and returns true if inserted", async () => {
    vi.spyOn(cleanupRepo, "resolveEffectiveTenantUserId").mockResolvedValueOnce("eff-u-1");
    const mockTx = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValueOnce([{ id: "j-create" }]),
    };

    vi.spyOn(tenantDb, "withTenant").mockImplementationOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (_tenant: any, cb: any) => cb(mockTx),
    );

    const created = await createDatabaseBackgroundJob(
      "demo",
      "u-1",
      {
        id: "j-create",
        moduleId: "messaging",
        kind: "sms",
        status: "pending",
        label: "SMS",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      { recipients: ["123"] },
    );
    expect(created).toBe(true);
  });

  it("dismissUserBackgroundJob dismisses and returns owner user id", async () => {
    vi.spyOn(tenantContext, "getRequestTenant").mockReturnValueOnce("demo");
    vi.spyOn(cleanupRepo, "resolveEffectiveTenantUserId").mockResolvedValueOnce("eff-u-1");

    const mockTx = {
      delete: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValueOnce([{ id: "j-del", userId: "u-1" }]),
    };

    vi.spyOn(tenantDb, "withTenant").mockImplementationOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (_tenant: any, cb: any) => cb(mockTx),
    );

    const owner = await dismissUserBackgroundJob("u-1", "j-del");
    expect(owner).toBe("u-1");
  });

  it("getUserBackgroundJobPayload returns payload from database", async () => {
    vi.spyOn(tenantContext, "getRequestTenant").mockReturnValueOnce("demo");
    vi.spyOn(cleanupRepo, "resolveEffectiveTenantUserId").mockResolvedValueOnce("eff-u-1");

    const mockTx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValueOnce([{ payload: { sample: "data" } }]),
    };

    vi.spyOn(tenantDb, "withTenant").mockImplementationOnce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (_tenant: any, cb: any) => cb(mockTx),
    );

    const payload = await getUserBackgroundJobPayload("u-1", "j-payload");
    expect(payload).toEqual({ sample: "data" });
  });
});

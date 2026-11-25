import { describe, expect, it, vi } from "vitest";
import { configureSessionTokenRevoker, revokeSession } from "./auth/sessionClock.js";
import {
  configurePlatformIdleMinutesProvider,
  platformSessionPolicy,
} from "./auth/sessionPolicy.js";
import {
  configureUploadsRootResolver,
  resolveSafeUploadDiskPath,
} from "./db-sync/backupAssetService.js";
import {
  configureRestoreDataSynchronizer,
  restoreWorkspaceWithAudit,
} from "./db-sync/restoreAudit.js";
import { configureJobTimeoutResolver, createJobDeadline } from "./jobs/backgroundJobDeadline.js";

/**
 * The injected ports replace app imports inside the kernel. Their safety
 * invariant is **fail closed**: an unconfigured port must throw instead of
 * silently skipping credential revocation, path resolution, the restore
 * synchronizer, or a job's execution budget — each of which would otherwise
 * look like success while leaving the system in a wrong state.
 *
 * These tests pin that invariant for every port registry (P1c).
 */
describe("kernel port registries fail closed", () => {
  it("sessionClock: revokeSession throws when the token revoker is unconfigured", async () => {
    configureSessionTokenRevoker(null);
    await expect(revokeSession("tn:t:u1", "jti-1")).rejects.toThrow(
      /token revoker is not configured/,
    );
  });

  it("sessionClock: a configured revoker receives the jti", async () => {
    const revoker = vi.fn().mockResolvedValue(undefined);
    configureSessionTokenRevoker(revoker);
    await revokeSession("tn:t:u1", "jti-2");
    expect(revoker).toHaveBeenCalledWith("jti-2");
    configureSessionTokenRevoker(null);
  });

  it("sessionPolicy: platformSessionPolicy throws when the idle-minutes provider is unconfigured", () => {
    configurePlatformIdleMinutesProvider(null);
    expect(() => platformSessionPolicy()).toThrow(/idle-minutes provider is not configured/);
  });

  it("sessionPolicy: a configured provider supplies the idle timeout", () => {
    configurePlatformIdleMinutesProvider(() => 45);
    const policy = platformSessionPolicy();
    expect(policy.idleMs).toBe(45 * 60_000);
    configurePlatformIdleMinutesProvider(null);
  });

  it("backupAssetService: resolveSafeUploadDiskPath throws when the uploads root is unconfigured", () => {
    configureUploadsRootResolver(null);
    expect(() => resolveSafeUploadDiskPath("/uploads/tenants/t/attachments/a.png")).toThrow(
      /uploads-root resolver is not configured/,
    );
  });

  it("backupAssetService: a configured root resolves paths and blocks traversal", () => {
    configureUploadsRootResolver(() => "/srv/uploads");
    expect(resolveSafeUploadDiskPath("/uploads/tenants/t/attachments/a.png")).toBe(
      "/srv/uploads/tenants/t/attachments/a.png",
    );
    expect(resolveSafeUploadDiskPath("/uploads/../etc/passwd")).not.toBe(
      "/srv/uploads/../etc/passwd",
    );
    configureUploadsRootResolver(null);
  });

  it("restoreAudit: restoreWorkspaceWithAudit throws when the synchronizer is unconfigured", async () => {
    configureRestoreDataSynchronizer(null);
    await expect(
      restoreWorkspaceWithAudit({
        tenant: "t",
        payload: { collections: {}, objects: {} } as never,
        actorUserId: "u1",
      }),
    ).rejects.toThrow(/data synchronizer is not configured/);
  });

  it("jobDeadline: createJobDeadline throws when the timeout resolver is unconfigured", () => {
    configureJobTimeoutResolver(null);
    expect(() => createJobDeadline("messaging", "campaign")).toThrow(
      /job timeout resolver is not configured/,
    );
  });

  it("jobDeadline: a configured resolver sets the budget", () => {
    configureJobTimeoutResolver(() => 12_000);
    const deadline = createJobDeadline("messaging", "campaign");
    expect(deadline.timeoutMs).toBe(12_000);
    deadline.dispose();
    configureJobTimeoutResolver(null);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AccountDeletionGuardNotConfiguredError,
  configureAccountDeletionGuard,
  isAccountDeleted,
} from "../middleware/accountDeletionGuard.js";

/**
 * The tenant auth guard's soft-deleted-account probe must be wired by the
 * composition root (routes/index.ts). Before that change the middleware imported
 * the faculty adapter directly; the port is fail-closed so a missing binding can
 * never extend a revoked session.
 */
describe("accountDeletionGuard port", () => {
  afterEach(() => {
    configureAccountDeletionGuard(null);
  });

  it("fails closed when no resolver is configured", async () => {
    await expect(isAccountDeleted("demo", "user-1")).rejects.toBeInstanceOf(
      AccountDeletionGuardNotConfiguredError,
    );
  });

  it("delegates to the configured resolver with the tenant and user id", async () => {
    const resolver = vi.fn(async () => true);
    configureAccountDeletionGuard(resolver);

    await expect(isAccountDeleted("demo", "user-1")).resolves.toBe(true);
    expect(resolver).toHaveBeenCalledWith("demo", "user-1");
  });

  it("propagates a resolver rejection (a DB failure must not read as 'active')", async () => {
    configureAccountDeletionGuard(async () => {
      throw new Error("db unavailable");
    });

    await expect(isAccountDeleted("demo", "user-1")).rejects.toThrow("db unavailable");
  });

  it("can be cleared back to the fail-closed state", async () => {
    configureAccountDeletionGuard(async () => false);
    await expect(isAccountDeleted("demo", "user-1")).resolves.toBe(false);

    configureAccountDeletionGuard(null);
    await expect(isAccountDeleted("demo", "user-1")).rejects.toBeInstanceOf(
      AccountDeletionGuardNotConfiguredError,
    );
  });
});

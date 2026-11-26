import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithTenant } from "@mms/be-core/http";
import { verifyPassword } from "../tenant/deps.js";
import { createWorkspaceUserHelper } from "../tenant/use-cases/userCreationUseCases.js";

const mocks = vi.hoisted(() => ({
  getHydratedUsers: vi.fn(),
  saveUsers: vi.fn(),
  getRawUsers: vi.fn(),
  invalidateTenantRbac: vi.fn(),
  broadcastCollection: vi.fn(),
  assertPasswordMeetsPolicy: vi.fn(),
  sendTenantWelcomeEmail: vi.fn(),
}));

vi.mock("../tenant/deps.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../tenant/deps.js")>()),
  getHydratedUsers: mocks.getHydratedUsers,
  saveUsers: mocks.saveUsers,
  getRawUsers: mocks.getRawUsers,
  assertPasswordMeetsPolicy: mocks.assertPasswordMeetsPolicy,
  sendTenantWelcomeEmail: mocks.sendTenantWelcomeEmail,
}));

vi.mock("@mms/be-core/rbac", () => ({
  invalidateTenantRbac: mocks.invalidateTenantRbac,
}));

vi.mock("@mms/be-core/realtime", () => ({
  broadcastCollection: mocks.broadcastCollection,
}));

vi.mock("../tenant/use-cases/userActivityLogUseCases.js", () => ({
  recordUserActivityLog: vi.fn().mockResolvedValue(undefined),
}));

const repo = {
  bulkSaveActivityLogs: vi.fn().mockResolvedValue(undefined),
} as never;

const baseInput = {
  contactId: "",
  name: "New Teacher",
  email: "teacher@demo.local",
  role: "teacher",
  status: "active" as const,
  twoFactorEnabled: false,
};

function savedRecord(): Record<string, unknown> {
  const saved = mocks.saveUsers.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
  return saved[saved.length - 1] as Record<string, unknown>;
}

describe("createWorkspaceUserHelper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHydratedUsers.mockResolvedValue([]);
    mocks.getRawUsers.mockResolvedValue([]);
    mocks.saveUsers.mockResolvedValue(undefined);
    mocks.assertPasswordMeetsPolicy.mockResolvedValue(undefined);
    mocks.sendTenantWelcomeEmail.mockResolvedValue({ sent: true });
  });

  it("verifies admin-set-password accounts and stores a hash that matches the temporary password", async () => {
    const temporaryPassword = "TempPass123!";

    await runWithTenant("demo", () =>
      createWorkspaceUserHelper(
        repo,
        { ...baseInput, setupMethod: "password", password: temporaryPassword },
        "actor",
        "admin",
      ),
    );

    const record = savedRecord();
    expect(record.mustChangePassword).toBe(true);
    expect(String(record.emailVerifiedAt)).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(record.passwordHash).toEqual(expect.any(String));
    // The production login path validates this exact hash.
    await expect(verifyPassword(temporaryPassword, String(record.passwordHash))).resolves.toBe(
      true,
    );
    await expect(verifyPassword("WrongPassword!", String(record.passwordHash))).resolves.toBe(
      false,
    );
    expect(mocks.sendTenantWelcomeEmail).not.toHaveBeenCalled();
  });

  it("honours forceReset=false for password mode", async () => {
    await runWithTenant("demo", () =>
      createWorkspaceUserHelper(
        repo,
        { ...baseInput, setupMethod: "password", password: "TempPass123!", forceReset: false },
        "actor",
        "admin",
      ),
    );

    expect(savedRecord().mustChangePassword).toBe(false);
  });

  it("keeps invite-created accounts unverified until activation", async () => {
    await runWithTenant("demo", () =>
      createWorkspaceUserHelper(repo, { ...baseInput, setupMethod: "invite" }, "actor", "admin"),
    );

    const record = savedRecord();
    expect(record.emailVerifiedAt).toBeUndefined();
    expect(mocks.sendTenantWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it("rejects password mode without a password", async () => {
    await expect(
      runWithTenant("demo", () =>
        createWorkspaceUserHelper(
          repo,
          { ...baseInput, setupMethod: "password" },
          "actor",
          "admin",
        ),
      ),
    ).rejects.toMatchObject({ statusCode: 400, type: "validation_error" });
    expect(mocks.saveUsers).not.toHaveBeenCalled();
  });

  it("rejects a missing setup method (no silent unloggable account)", async () => {
    await expect(
      runWithTenant("demo", () =>
        createWorkspaceUserHelper(repo, { ...baseInput } as never, "actor", "admin"),
      ),
    ).rejects.toMatchObject({ statusCode: 400, type: "validation_error" });
    expect(mocks.saveUsers).not.toHaveBeenCalled();
  });

  it("rejects creating a platform-managed super admin", async () => {
    await expect(
      runWithTenant("demo", () =>
        createWorkspaceUserHelper(
          repo,
          { ...baseInput, role: "super_admin", setupMethod: "invite" },
          "actor",
          "super_admin",
        ),
      ),
    ).rejects.toMatchObject({ statusCode: 403, type: "platform_managed_role" });
    expect(mocks.saveUsers).not.toHaveBeenCalled();
  });
});

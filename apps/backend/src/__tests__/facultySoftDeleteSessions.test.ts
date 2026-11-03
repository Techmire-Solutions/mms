import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revokeAllUserSessions: vi.fn(),
  revokeUserSessionKeys: vi.fn(),
  listUsers: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../services/authSessionService.js", () => ({
  revokeAllUserSessions: mocks.revokeAllUserSessions,
  revokeUserSessionKeys: mocks.revokeUserSessionKeys,
}));

vi.mock("../db/repositories/tenantUserRepository.js", () => ({
  listAllTenantUsersByWorkspace: mocks.listUsers,
}));

vi.mock("../lib/logger.js", () => ({
  logger: { error: mocks.loggerError, warn: vi.fn(), info: vi.fn() },
}));

import { revokeFacultySessions } from "../faculty/use-cases/facultySoftDeleteSessions.js";
import type { Faculty } from "@mms/shared";

const members = [
  { id: "fac-1", contactId: "c-1" },
  { id: "fac-2", contactId: null, userId: "usr-direct" },
] as unknown as Faculty[];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.revokeAllUserSessions.mockResolvedValue(undefined);
  mocks.revokeUserSessionKeys.mockResolvedValue(undefined);
  mocks.listUsers.mockResolvedValue([
    { id: "usr-linked", contactId: "c-1" },
    { id: "usr-other", contactId: "c-9" },
  ]);
});

describe("revokeFacultySessions", () => {
  it("revokes sessions by user id resolved from contacts and direct links", async () => {
    await revokeFacultySessions("demo", members);

    const revoked = mocks.revokeAllUserSessions.mock.calls.map((call) => call[0]);
    expect([...revoked].sort()).toEqual(["usr-direct", "usr-linked"]);
  });

  it("never revokes using a faculty id (session keys are user ids)", async () => {
    await revokeFacultySessions("demo", members);

    const revoked = mocks.revokeAllUserSessions.mock.calls.map((call) => call[0]);
    expect(revoked).not.toContain("fac-1");
    expect(revoked).not.toContain("fac-2");
    expect(mocks.revokeUserSessionKeys).not.toHaveBeenCalledWith("fac-1");
  });

  it("logs a revocation failure instead of failing silently", async () => {
    mocks.revokeAllUserSessions.mockRejectedValue(new Error("redis down"));

    await expect(revokeFacultySessions("demo", members)).resolves.toBeUndefined();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ tenant: "demo", facultyIds: ["fac-1", "fac-2"] }),
      expect.stringContaining("session revocation failed"),
    );
  });
});

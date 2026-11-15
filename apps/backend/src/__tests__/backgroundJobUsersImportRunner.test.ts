import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  importBatch: undefined as
    ((rows: unknown[], ctx: Record<string, unknown>) => Promise<unknown>) | undefined,
  createWorkspaceUser: vi.fn(),
  resolveCurrentTenantRole: vi.fn(),
}));

vi.mock("../lib/registerModuleCsvImportJobRunner.js", () => ({
  registerModuleCsvImportJobRunner: (o: { importBatch: unknown }) => {
    h.importBatch = o.importBatch as typeof h.importBatch;
  },
}));
vi.mock("../users/use-cases/usersUseCases.js", () => ({
  usersUseCases: { createWorkspaceUser: h.createWorkspaceUser },
}));
vi.mock("../lib/currentTenantRole.js", () => ({
  resolveCurrentTenantRole: h.resolveCurrentTenantRole,
}));

import { registerUsersImportJobRunner } from "../services/backgroundJobUsersRunners.js";

describe("users import runner", () => {
  beforeEach(() => {
    h.createWorkspaceUser.mockReset().mockResolvedValue({});
    h.resolveCurrentTenantRole.mockReset().mockResolvedValue("admin");
  });

  it("provisions users in INVITED status without secrets and reports failing rows", async () => {
    registerUsersImportJobRunner();
    h.createWorkspaceUser.mockImplementation(async (input: { email?: string }) => {
      if (input.email === "dup@madrasa.org") throw new Error("duplicate_user_email");
      return {};
    });

    const result = (await h.importBatch!(
      [
        { name: "Fatima Zahra", email: "fatima@madrasa.org", role: "teacher" },
        { name: "Dup", email: "dup@madrasa.org", role: "viewer" },
      ],
      {
        tenant: "demo",
        userId: "u1",
        jobId: "job-1",
        viewerRole: "admin",
        updateProgress: vi.fn().mockResolvedValue(undefined),
      },
    )) as { imported: number; failed: number; errors?: Array<{ row: number; reason: string }> };

    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors?.[0]).toMatchObject({ row: 2 });
    expect(h.createWorkspaceUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "fatima@madrasa.org",
        setupMethod: "invite",
        status: "inactive",
      }),
      "u1",
      "admin",
    );
  });
});

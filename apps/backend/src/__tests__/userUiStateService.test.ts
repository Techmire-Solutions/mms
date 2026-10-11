import { describe, expect, it, vi, beforeEach } from "vitest";

const mockWithTenant = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (subdomain: string, cb: (tx: any) => Promise<unknown>) =>
    mockWithTenant(subdomain, cb),
}));

import { getUserUiState, patchUserUiState } from "../services/auth/userUiStateService.js";

describe("userUiStateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserUiState", () => {
    it("returns empty object when no record found", async () => {
      mockWithTenant.mockImplementationOnce(async (_subdomain, cb) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
        return cb(mockTx);
      });

      const state = await getUserUiState("tenant1", "user1");
      expect(state).toEqual({});
    });

    it("returns record state when found", async () => {
      mockWithTenant.mockImplementationOnce(async (_subdomain, cb) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ state: { theme: "dark" } }]),
            }),
          }),
        };
        return cb(mockTx);
      });

      const state = await getUserUiState("tenant1", "user1");
      expect(state).toEqual({ theme: "dark" });
    });
  });

  describe("patchUserUiState", () => {
    it("merges new state with existing state and returns updated state", async () => {
      // First call for getUserUiState
      mockWithTenant.mockImplementationOnce(async (_subdomain, cb) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ state: { theme: "light", sidebar: "open" } }]),
            }),
          }),
        };
        return cb(mockTx);
      });

      // Second call for insert/update
      mockWithTenant.mockImplementationOnce(async (_subdomain, cb) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              onConflictDoUpdate: vi.fn().mockReturnValue({
                returning: vi
                  .fn()
                  .mockResolvedValue([{ state: { theme: "dark", sidebar: "open" } }]),
              }),
            }),
          }),
        };
        return cb(mockTx);
      });

      const result = await patchUserUiState("tenant1", "user1", { state: { theme: "dark" } });
      expect(result).toEqual({ theme: "dark", sidebar: "open" });
    });

    it("gracefully handles foreign_key_violation 23503 error", async () => {
      mockWithTenant.mockImplementationOnce(async (_subdomain, cb) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
        return cb(mockTx);
      });

      mockWithTenant.mockImplementationOnce(async () => {
        const err = new Error("Foreign key violation") as Error & { code: string };
        err.code = "23503";
        throw err;
      });

      const result = await patchUserUiState("tenant1", "user1", { state: { theme: "system" } });
      expect(result).toEqual({ theme: "system" });
    });

    it("re-throws unexpected errors", async () => {
      mockWithTenant.mockImplementationOnce(async (_subdomain, cb) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
        return cb(mockTx);
      });

      mockWithTenant.mockImplementationOnce(async () => {
        throw new Error("Database connection failed");
      });

      await expect(
        patchUserUiState("tenant1", "user1", { state: { theme: "system" } }),
      ).rejects.toThrow("Database connection failed");
    });
  });
});

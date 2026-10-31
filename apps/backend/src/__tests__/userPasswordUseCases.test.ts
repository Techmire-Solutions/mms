import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";
import {
  executeUserPasswordReset,
  runPasswordResetAuxiliaryStep,
  runPasswordResetStage,
  UserPasswordResetError,
} from "../users/use-cases/userPasswordUseCases.js";
import { HttpDomainError } from "../lib/httpErrors.js";
import type { UsersRepository } from "../users/repository/usersRepository.js";
import { withTenant, type TenantTransaction } from "../db/tenant-context.js";
import { deleteRefreshTokensForUser } from "../services/auth/authArtifactService.js";
import { hashPassword } from "../services/auth/passwordService.js";
import { assertPasswordMeetsPolicy } from "../services/globalSettingsService.js";
import { revokeAllUserSessions } from "../services/authSessionService.js";
import { broadcastCollection } from "../lib/livePush.js";
import { recordUserActivityLog } from "../users/use-cases/userActivityLogUseCases.js";

vi.mock("../db/tenant-context.js", () => ({
  withTenant: vi.fn((_subdomain, callback) => callback({} as unknown as TenantTransaction)),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  deleteRefreshTokensForUser: vi.fn(),
}));

vi.mock("../services/auth/passwordService.js", () => ({
  hashPassword: vi.fn(),
}));

vi.mock("../services/globalSettingsService.js", () => ({
  assertPasswordMeetsPolicy: vi.fn(),
}));

vi.mock("../services/authSessionService.js", () => ({
  revokeAllUserSessions: vi.fn(),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn(),
}));

vi.mock("../users/use-cases/userActivityLogUseCases.js", () => ({
  recordUserActivityLog: vi.fn(),
}));

const TENANT = "tenant-users";

describe("userPasswordUseCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runPasswordResetStage", () => {
    it("given UserPasswordResetError, should rethrow error without re-wrapping", async () => {
      const original = new UserPasswordResetError("password_hash", new Error("Bcrypt failure"));
      await expect(
        runPasswordResetStage("password_hash", async () => {
          throw original;
        }),
      ).rejects.toBe(original);
    });

    it("given HTTP 403 error, should rethrow directly without wrapping in UserPasswordResetError", async () => {
      const httpError = new HttpDomainError(403, "forbidden", "Not allowed");
      await expect(
        runPasswordResetStage("load_user", async () => {
          throw httpError;
        }),
      ).rejects.toBe(httpError);
    });

    it("given unexpected internal error, should wrap in UserPasswordResetError with stage name", async () => {
      await expect(
        runPasswordResetStage("credential_update", async () => {
          throw new Error("Disk full");
        }),
      ).rejects.toThrow(UserPasswordResetError);
    });
  });

  describe("runPasswordResetAuxiliaryStep", () => {
    it("given auxiliary step error, should isolate error and forward to onError handler", async () => {
      const onError = vi.fn();
      const failure = new Error("Redis connection dropped");

      await runPasswordResetAuxiliaryStep(
        "users_broadcast",
        async () => {
          throw failure;
        },
        onError,
      );

      expect(onError).toHaveBeenCalledWith("users_broadcast", failure);
    });
  });

  describe("executeUserPasswordReset", () => {
    it("given missing tenant context, should throw HttpDomainError 400", async () => {
      const mockRepo = {} as unknown as UsersRepository;

      await expect(
        executeUserPasswordReset(mockRepo, {
          id: "u-1",
          temporaryPassword: "Password123!",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        type: "tenant_context_required",
        message: "Tenant context required",
      });
    });

    it("given non-existent or soft-deleted user, should return false", async () => {
      const mockRepo = {
        findTenantUserRowById: vi.fn().mockResolvedValue(null),
      } as unknown as UsersRepository;

      await runWithTenant(TENANT, async () => {
        const result = await executeUserPasswordReset(mockRepo, {
          id: "u-missing",
          temporaryPassword: "Password123!",
        });
        expect(result).toBe(false);
      });
    });

    it("given subordinate actor attempting to reset super_admin, should throw 403 HttpDomainError", async () => {
      const mockRepo = {
        findTenantUserRowById: vi.fn().mockResolvedValue({
          id: "u-super",
          role: "super_admin",
          deletedAt: null,
        }),
      } as unknown as UsersRepository;

      await runWithTenant(TENANT, async () => {
        await expect(
          executeUserPasswordReset(mockRepo, {
            id: "u-super",
            temporaryPassword: "Password123!",
            actorRole: "teacher",
          }),
        ).rejects.toMatchObject({
          statusCode: 403,
          type: "forbidden_super_admin_mutation",
          message: "Cannot reset password of a Super Admin user account",
        });
      });
    });

    it("given valid parameters, should hash password, update credentials atomically, and revoke sessions", async () => {
      const mockRepo = {
        findTenantUserRowById: vi.fn().mockResolvedValue({
          id: "u-target",
          name: "Fatima Noor",
          role: "teacher",
          deletedAt: null,
        }),
        resetTenantUserPasswordRow: vi.fn().mockResolvedValue(true),
      } as unknown as UsersRepository;

      vi.mocked(hashPassword).mockResolvedValue("hashed_temp_pw");

      await runWithTenant(TENANT, async () => {
        const result = await executeUserPasswordReset(mockRepo, {
          id: "u-target",
          temporaryPassword: "ValidTempPass123!",
          actorRole: "admin",
          actorId: "actor-1",
          ip: "10.0.0.1",
        });

        expect(result).toBe(true);
        expect(assertPasswordMeetsPolicy).toHaveBeenCalledWith("ValidTempPass123!");
        expect(hashPassword).toHaveBeenCalledWith("ValidTempPass123!");
        expect(withTenant).toHaveBeenCalledWith(TENANT, expect.any(Function));
        expect(mockRepo.resetTenantUserPasswordRow).toHaveBeenCalledWith(
          TENANT,
          "u-target",
          "hashed_temp_pw",
        );
        expect(deleteRefreshTokensForUser).toHaveBeenCalledWith("u-target");
        expect(revokeAllUserSessions).toHaveBeenCalledWith("u-target");
        expect(broadcastCollection).toHaveBeenCalledWith("users");
        expect(recordUserActivityLog).toHaveBeenCalledWith(
          mockRepo,
          TENANT,
          "actor-1",
          "update",
          "Reset password for user Fatima Noor",
          "10.0.0.1",
        );
      });
    });
  });
});

import type { UsersRepository } from "../repository/usersRepository.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { withTenant } from "../../db/tenant-context.js";
import { deleteRefreshTokensForUser } from "../../services/auth/authArtifactService.js";
import { hashPassword } from "../../services/auth/passwordService.js";
import { assertPasswordMeetsPolicy } from "../../services/globalSettingsService.js";
import { revokeAllUserSessions } from "../../services/authSessionService.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { canManageTargetUser } from "@mms/shared";
import { HttpDomainError } from "../../lib/httpErrors.js";
import { recordUserActivityLog } from "./userActivityLogUseCases.js";

export type UserPasswordResetFailureStage =
  | "load_user"
  | "password_policy"
  | "password_hash"
  | "credential_transaction"
  | "credential_update"
  | "refresh_token_revocation"
  | "session_revocation";

export type UserPasswordResetAuxiliaryStage = "users_broadcast" | "activity_log";

export type UserPasswordResetAuxiliaryErrorHandler = (
  stage: UserPasswordResetAuxiliaryStage,
  error: unknown,
) => void;

export class UserPasswordResetError extends Error {
  readonly type = "password_reset_failed";

  constructor(
    readonly passwordResetStage: UserPasswordResetFailureStage,
    cause: unknown,
  ) {
    super(`Password reset failed during ${passwordResetStage}`, { cause });
    this.name = "UserPasswordResetError";
  }
}

export async function runPasswordResetStage<T>(
  stage: UserPasswordResetFailureStage,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (error instanceof UserPasswordResetError) throw error;
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (typeof statusCode === "number" && statusCode < 500) throw error;
    throw new UserPasswordResetError(stage, error);
  }
}

export async function runPasswordResetAuxiliaryStep(
  stage: UserPasswordResetAuxiliaryStage,
  operation: () => Promise<void>,
  onError?: UserPasswordResetAuxiliaryErrorHandler,
): Promise<void> {
  try {
    await operation();
  } catch (error: unknown) {
    onError?.(stage, error);
  }
}

export async function executeUserPasswordReset(
  repo: UsersRepository,
  params: {
    id: string;
    temporaryPassword: string;
    actorRole?: string;
    actorId?: string;
    ip?: string;
    onAuxiliaryError?: UserPasswordResetAuxiliaryErrorHandler;
  },
): Promise<boolean> {
  const {
    id,
    temporaryPassword,
    actorRole,
    actorId = "system",
    ip = "127.0.0.1",
    onAuxiliaryError,
  } = params;

  const tenant = getRequestTenant()?.trim().toLowerCase();
  if (!tenant) {
    throw new HttpDomainError(400, "tenant_context_required", "Tenant context required");
  }

  // Tenant-scoped lookup: the workspace predicate is enforced in SQL, so a
  // foreign user id can never resolve here.
  const existing = await runPasswordResetStage("load_user", () =>
    repo.findTenantUserRowById(tenant, id),
  );
  if (!existing || existing.deletedAt) {
    return false;
  }

  if (actorRole && !canManageTargetUser(actorRole, existing.role)) {
    throw new HttpDomainError(
      403,
      "forbidden_super_admin_mutation",
      "Cannot reset password of a Super Admin user account",
    );
  }

  await runPasswordResetStage("password_policy", () =>
    assertPasswordMeetsPolicy(temporaryPassword),
  );
  const passwordHash = await runPasswordResetStage("password_hash", () =>
    hashPassword(temporaryPassword),
  );
  const updated = await runPasswordResetStage("credential_transaction", () =>
    withTenant(tenant, async () => {
      const passwordUpdated = await runPasswordResetStage("credential_update", () =>
        repo.resetTenantUserPasswordRow(tenant, id, passwordHash),
      );
      if (!passwordUpdated) return false;

      // Keep the credential update and persistent refresh-token revocation atomic.
      await runPasswordResetStage("refresh_token_revocation", () => deleteRefreshTokensForUser(id));
      return true;
    }),
  );
  if (!updated) return false;

  await runPasswordResetStage("session_revocation", () => revokeAllUserSessions(id));
  await runPasswordResetAuxiliaryStep(
    "users_broadcast",
    () => broadcastCollection("users"),
    onAuxiliaryError,
  );

  await runPasswordResetAuxiliaryStep(
    "activity_log",
    () =>
      recordUserActivityLog(
        repo,
        tenant,
        actorId,
        "update",
        `Reset password for user ${existing.name || id}`,
        ip,
      ),
    onAuxiliaryError,
  );
  return true;
}

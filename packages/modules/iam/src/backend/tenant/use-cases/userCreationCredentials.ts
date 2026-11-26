import { randomBytes } from "node:crypto";
import { HttpDomainError } from "@mms/be-core/http/errors";
import { hashPassword } from "../deps.js";
import { assertPasswordMeetsPolicy } from "../deps.js";

export type TenantUserSetupMethod = "invite" | "password";

export interface TenantUserSetupInput {
  setupMethod: TenantUserSetupMethod;
  password: string | undefined;
  forceReset: boolean | undefined;
}

/**
 * Validates the create/invite credential contract before any record is written.
 *
 * A password-method account without a password would persist an empty hash (an
 * unloggable account), and a password in invite mode would silently bypass the
 * activation flow — both are rejected here even for non-contract callers (CSV
 * import, background runners).
 */
export function resolveTenantUserSetup(input: Record<string, unknown>): TenantUserSetupInput {
  const setupMethod = input.setupMethod;
  if (setupMethod !== "invite" && setupMethod !== "password") {
    throw new HttpDomainError(
      400,
      "validation_error",
      "Choose how the account is set up: invite or temporary password",
    );
  }

  const password = input.password;
  if (setupMethod === "password") {
    if (typeof password !== "string" || !password.trim()) {
      throw new HttpDomainError(400, "validation_error", "Temporary password is required");
    }
  } else if (password !== undefined) {
    throw new HttpDomainError(
      400,
      "validation_error",
      "A password can only be provided in temporary-password mode",
    );
  }

  return {
    setupMethod,
    password: typeof password === "string" ? password : undefined,
    forceReset: typeof input.forceReset === "boolean" ? input.forceReset : undefined,
  };
}

export interface TenantUserInitialCredential {
  passwordHash: string;
  mustChangePassword: boolean;
  /** An admin-set password vouches for the address (satisfies the verification policy). */
  emailVerifiedAt?: string;
}

/** Hashes the admin-supplied temporary password or an unguessable invite placeholder. */
export async function buildTenantUserInitialCredential(
  input: TenantUserSetupInput,
): Promise<TenantUserInitialCredential> {
  if (input.setupMethod === "password" && input.password) {
    await assertPasswordMeetsPolicy(input.password);
    return {
      passwordHash: await hashPassword(input.password),
      mustChangePassword: input.forceReset !== false,
      emailVerifiedAt: new Date().toISOString(),
    };
  }
  // Invite: an unguessable placeholder password; activation sets the real one.
  return {
    passwordHash: await hashPassword(randomBytes(32).toString("hex")),
    mustChangePassword: false,
  };
}

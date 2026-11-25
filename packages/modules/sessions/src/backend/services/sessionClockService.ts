import { configureSessionTokenRevoker } from "@mms/be-core/auth/sessionClock";
import { tenantSessionScope, platformSessionScope } from "@mms/be-core/auth";

/**
 * Register the access-token revoker lazily rather than with a static import:
 * tests that `vi.mock` `authSessionService` with a partial object (without
 * `revokeToken`) must not fail at module-load time, and the revoker is only
 * resolved on first use (when `revokeSession(scope, jti)` actually runs).
 */
configureSessionTokenRevoker(async (jti: string) => {
  const { revokeToken } = await import("@mms/be-core/auth/sessionRevocation");
  await revokeToken(jti);
});

export * from "@mms/be-core/auth/sessionClock";
export { tenantSessionScope, platformSessionScope };

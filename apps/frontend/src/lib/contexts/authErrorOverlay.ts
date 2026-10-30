import type { TenantAuthErrorType } from "@mms/shared";
import { isEntryPath, ROUTES } from "@/lib/config/routes";

export interface UserNotRegisteredOverlayInput {
  isTenantHost: boolean;
  pathname: string;
  authErrorType: TenantAuthErrorType | undefined;
}

/**
 * The `user_not_registered` screen replaces the entire tenant host, so it must
 * never override a page that the visitor still needs: sign-in, forgot-password,
 * 2FA, or the public admissions forms. A stale login error otherwise left the
 * user stranded until they signed out (there is no session to sign out of yet).
 */
export function shouldShowUserNotRegisteredOverlay({
  isTenantHost,
  pathname,
  authErrorType,
}: UserNotRegisteredOverlayInput): boolean {
  if (!isTenantHost || authErrorType !== "user_not_registered") return false;
  if (isEntryPath(pathname, { isApex: false })) return false;
  if (pathname === ROUTES.apply || pathname.startsWith(`${ROUTES.apply}/`)) return false;
  return true;
}

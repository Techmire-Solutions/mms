import { ROUTES } from "@mms/fe-core/config/routes";

let loginPromise: Promise<typeof import("@/tenant/pages/auth/Login")> | null = null;

export function loadLoginPage(): Promise<typeof import("@/tenant/pages/auth/Login")> {
  if (!loginPromise) {
    loginPromise = import("@/tenant/pages/auth/Login");
  }
  return loginPromise;
}

/** Starts loading the Login route chunk early when booting at `/` or `/login` outside Vitest. */
export function preloadLoginOnEntryBoot(): void {
  if (import.meta.env.MODE === "test" || typeof window === "undefined") return;
  const { pathname } = window.location;
  if (pathname === ROUTES.home || pathname === ROUTES.login) {
    void loadLoginPage();
  }
}

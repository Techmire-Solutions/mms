/**
 * Per-process request context (tenant subdomain, authenticated user, audit
 * metadata) shared by every data-layer entry point.
 *
 * Moved from the backend's `lib/tenantContext.ts` so `@mms/db` can enforce tenant
 * scoping without importing the app. `AsyncLocalStorage` is a Node built-in, so
 * this module is Node-only by design; it is not part of the contract surface.
 *
 * The backend keeps a thin `lib/tenantContext.ts` that re-exports this module and
 * adds the HTTP-only `resolveSubdomainFromRequest` helper.
 */
import { AsyncLocalStorage } from "node:async_hooks";

const tenantStorage = new AsyncLocalStorage<string | null>();
const requestUserIdStorage = new AsyncLocalStorage<string | null>();

/** Returns the active tenant subdomain for the current async request, if any. */
export function getRequestTenant(): string | null {
  return tenantStorage.getStore() ?? null;
}

/** Returns the active tenant subdomain or throws if missing (strict context requirement). */
export function requireTenant(): string {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  return tenant.trim().toLowerCase();
}

/** Authenticated user id for the current request (audit GUCs), if any. */
export function getRequestUserId(): string | null {
  return requestUserIdStorage.getStore() ?? null;
}

/**
 * Binds the authenticated user id for the remainder of the request.
 * Prefer `enterWith` from auth middleware so nested transactions can set `app.current_user_id`.
 */
export function bindRequestUserId(userId: string | null): void {
  requestUserIdStorage.enterWith(userId);
}

/** Runs a callback with tenant context bound (used during onboarding on apex). */
export function runWithTenant<T>(subdomain: string | null, fn: () => T): T {
  return tenantStorage.run(subdomain, fn);
}

/**
 * Binds the active tenant subdomain for the remainder of the request.
 * Uses `enterWith` so AsyncLocalStorage context persists across all Fastify lifecycle hooks.
 */
export function bindRequestTenant(subdomain: string | null): void {
  tenantStorage.enterWith(subdomain);
}

export interface RequestAuditContext {
  correlationId?: string;
  ipAddress?: string;
  clientApp?: string;
  sessionId?: string;
  apiEndpoint?: string;
  httpMethod?: string;
  impersonatedUserId?: string;
}

const requestAuditContextStorage = new AsyncLocalStorage<RequestAuditContext | null>();

/** Returns the active request audit context (W3C traceparent, IP, endpoint, etc.) if any. */
export function getRequestAuditContext(): RequestAuditContext | null {
  return requestAuditContextStorage.getStore() ?? null;
}

/**
 * Binds the request audit context for the remainder of the request.
 * Populates 5-dimension audit metadata automatically across async calls.
 */
export function bindRequestAuditContext(context: RequestAuditContext | null): void {
  requestAuditContextStorage.enterWith(context);
}

export { tenantStorage, requestAuditContextStorage };

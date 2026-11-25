import { DEFAULT_GLOBAL_SETTINGS } from "@mms/contracts";
import { vi } from "vitest";

/**
 * Shared mocks for the DB-backed ports of the extracted `tenantAuthGuard`
 * (`apps/api/src/middleware/authenticate.ts`) and the audit write fired from
 * module route helpers.
 *
 * The guard re-resolves the caller's authoritative role, global settings and
 * account soft-delete state on every request; route helpers then write an audit
 * event. Mocked suites never initialise the `@mms/db` client, so a guarded route
 * answered `500 {"type":"server_error","message":"Database not initialized"}`.
 * Suites that only care about the route under test wire these factories and keep
 * the JWTs real. `vi.mock` is hoisted above imports, so reference the helper
 * through a dynamic import inside the factory:
 *
 * ```ts
 * vi.mock("../services/rbacService.js", (io) =>
 *   import("./helpers/authGuardMocks.js").then((m) => m.rbacServiceMock(io)),
 * );
 * vi.mock("../services/globalSettingsService.js", (io) =>
 *   import("./helpers/authGuardMocks.js").then((m) => m.globalSettingsServiceMock(io)),
 * );
 * vi.mock("../middleware/accountDeletionGuard.js", (io) =>
 *   import("./helpers/authGuardMocks.js").then((m) => m.accountDeletionGuardMock(io)),
 * );
 * vi.mock("@mms/be-core/audit", (io) =>
 *   import("./helpers/authGuardMocks.js").then((m) => m.auditMock(io)),
 * );
 * ```
 *
 * Suites that deliberately exercise the real guard (`auth.integration`,
 * `authenticateFreshRole`, `authRedisCaching`, `customRoleAuthorization`,
 * `accountDeletionGuard`, `tenantScopeGuards`) must not use these.
 */

export type TenantRoleMatrix = Record<string, { role: string; deletedAt: unknown }>;

/** The ids minted by `apps/api/src/__tests__/helpers/tokens.ts`. */
export const TENANT_ROLE_MATRIX: TenantRoleMatrix = {
  "u-admin": { role: "admin", deletedAt: null },
  "u-principal": { role: "principal", deletedAt: null },
  "u-registrar": { role: "registrar", deletedAt: null },
  "u-teacher": { role: "teacher", deletedAt: null },
  "u-accountant": { role: "accountant", deletedAt: null },
  "u-assistant_teacher": { role: "assistant_teacher", deletedAt: null },
  "u-viewer": { role: "viewer", deletedAt: null },
  "u-guardian": { role: "guardian", deletedAt: null },
  "u-auditor": { role: "auditor", deletedAt: null },
};

type ImportOriginal = () => Promise<Record<string, unknown>>;

/** `../services/rbacService.js` factory returning the fixed role matrix. */
export async function rbacServiceMock(
  importOriginal: ImportOriginal,
  matrix: TenantRoleMatrix = TENANT_ROLE_MATRIX,
): Promise<Record<string, unknown>> {
  const actual = await importOriginal();
  return { ...actual, getTenantRoleMatrix: vi.fn(async () => matrix) };
}

/** `../services/globalSettingsService.js` factory returning default settings. */
export async function globalSettingsServiceMock(
  importOriginal: ImportOriginal,
  settings: Record<string, unknown> = { ...DEFAULT_GLOBAL_SETTINGS },
): Promise<Record<string, unknown>> {
  const actual = await importOriginal();
  return { ...actual, loadGlobalSettings: vi.fn(async () => settings) };
}

/** `../middleware/accountDeletionGuard.js` factory reporting an active account. */
export async function accountDeletionGuardMock(
  importOriginal: ImportOriginal,
): Promise<Record<string, unknown>> {
  const actual = await importOriginal();
  return { ...actual, isAccountDeleted: vi.fn(async () => false) };
}

/** `@mms/be-core/audit` factory: swallow route audit writes. */
export async function auditMock(importOriginal: ImportOriginal): Promise<Record<string, unknown>> {
  const actual = await importOriginal();
  return { ...actual, recordModernAuditEvent: vi.fn(async () => undefined) };
}

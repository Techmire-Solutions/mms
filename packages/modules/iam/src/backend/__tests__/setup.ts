import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { vi } from "vitest";
import { configureIamUsersPorts, type IamUsersPorts } from "../tenant/deps.js";

const scryptAsync = promisify(scrypt);

async function testHashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function testVerifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const hashBuffer = Buffer.from(hash, "hex");
  if (derivedKey.length !== hashBuffer.length) return false;
  return timingSafeEqual(derivedKey, hashBuffer);
}

// Permissive defaults for the app-bound users ports; suites override individual
// bindings with partial `vi.mock("../tenant/deps.js", importOriginal)` factories.
const noop = vi.fn(async () => ({}));
configureIamUsersPorts({
  loadContactsByIds: vi.fn(async () => []),
  findFacultyByContactId: vi.fn(async () => null),
  isFacultyDesignationRoleLocked: vi.fn(() => false),
  listFacultyDesignations: vi.fn(async () => []),
  resolveFacultyContactRoleAssignment: vi.fn(async () => null),
  upsertFacultyManagedWorkspaceRole: noop,
  mergeWorkspaceRolesForPrefsSave: noop,
  findActivityLogById: noop,
  findActivityLogsByIds: vi.fn(async () => []),
  listActivityLogsByWorkspace: vi.fn(async () => []),
  saveActivityLog: noop,
  bulkSaveActivityLogs: noop,
  replaceActivityLogsForWorkspace: noop,
  getWorkspaceWithBranding: noop,
  findWorkspaceBySubdomain: noop,
  findWorkspaceById: noop,
  normalizeSubdomainInput: vi.fn((s: string) => s),
  getGlobalSettings: vi.fn(async () => ({})),
  hashPassword: vi.fn(testHashPassword),
  assertPasswordMeetsPolicy: vi.fn(() => true),
  getHydratedUsers: vi.fn(async () => []),
  saveUsers: noop,
  getRawUsers: vi.fn(async () => []),
  sendTenantWelcomeEmail: noop,
  deleteRefreshTokensForUser: noop,
  getUserUiState: vi.fn(async () => ({})),
  patchUserUiState: vi.fn(async () => ({})),
  verifyPassword: vi.fn(testVerifyPassword),
  changeTenantUserPassword: noop,
  validateCredentials: noop,
  userUiState: {},
  getPreparedTenantUserById: vi.fn(() => ({ execute: async () => null })),
  invalidateTenantRbac: noop,
  createStrictRateLimitGuard: vi.fn(() => async () => undefined),
  enqueueCsvExportJob: noop,
  normalizeExportQuery: vi.fn((q: unknown) => q),
  enqueueBackgroundJob: noop,
  getUserBackgroundJob: vi.fn(async () => null),
  getUserBackgroundJobPayload: vi.fn(async () => null),
  retryFailedBackgroundJob: noop,
  hasBackgroundJobRunner: vi.fn(() => true),
  isBackgroundJobLimitError: vi.fn(() => false),
  isQueueUnavailableError: vi.fn(() => false),
  registerModuleCsvExportJobRunner: vi.fn(),
} as unknown as IamUsersPorts);

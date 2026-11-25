import { vi } from "vitest";
import { configureMessagingPorts } from "../deps.js";

// Deterministic defaults for the app-bound ports; tests that assert behaviour
// override them with their own `vi.mock("../deps.js", ...)`.
configureMessagingPorts({
  loadContactsPageForTenant: vi.fn(async () => ({ contacts: [], total: 0 })),
  loadContactsSummaryByIdsForTenant: vi.fn(async () => []),
  loadContactFieldConfig: vi.fn(async () => ({})),
  sendTenantSms: vi.fn(async () => ({ ok: true })),
  sendTenantWhatsApp: vi.fn(async () => ({ ok: true })),
  sendTenantEmail: vi.fn(async () => ({ ok: true })),
  createStrictRateLimitGuard: vi.fn(() => async () => undefined),
  enqueueBackgroundJob: vi.fn(async () => ({ id: "job-1" })),
  getUserBackgroundJob: vi.fn(async () => null),
  getUserBackgroundJobPayload: vi.fn(async () => null),
  authArtifactUserScopeKey: vi.fn(() => "user"),
  authArtifactWorkspaceScopeKey: vi.fn(() => "workspace"),
  deleteAuthArtifact: vi.fn(async () => undefined),
  findAuthArtifactByLookupKey: vi.fn(async () => null),
  tryClaimAuthArtifactByLookupKey: vi.fn(async () => ({ claimed: true, id: "artifact-1" })),
  updateAuthArtifactPayload: vi.fn(async () => undefined),
  registerModuleCsvExportJobRunner: vi.fn(),
});

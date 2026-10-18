import type { IndustryType } from "./industryTypes.js";

/** Workspace / tenant record created during onboarding. */
export interface Workspace {
  id: string;
  subdomain: string;
  madrasaName: string;
  tagline?: string;
  country?: string;
  /** Independent industry profile key (modules/blueprint/roles/terminology resolvers). */
  industryType?: IndustryType | string;
  createdAt: string;
  /** When false, tenant sign-in and app routes are blocked until re-enabled by platform admin. */
  enabled?: boolean;
}

/** Returns true when the workspace accepts tenant traffic (missing `enabled` = active). */
export function isWorkspaceEnabled(workspace: Pick<Workspace, "enabled">): boolean {
  return workspace.enabled !== false;
}

/** Public workspace row for apex registry / workspace picker UI. */
export interface PublicWorkspaceSummary {
  subdomain: string;
  madrasaName: string;
  tagline?: string;
  logoUrl?: string;
}

/** Platform console row — includes activation state for super-user management. */
export interface PlatformWorkspaceRow extends PublicWorkspaceSummary {
  enabled: boolean;
  createdAt: string;
  requireEmailVerification?: boolean;
  adminEmail?: string;
}

/** Response body for `GET /api/workspace/registry` (apex only). */
export interface WorkspaceRegistryResponse {
  workspaces: PublicWorkspaceSummary[];
}

/** Response body for `GET /api/platform/workspaces` (paginated). */
export interface PlatformWorkspaceListResponse {
  workspaces: PlatformWorkspaceRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Response body for `GET /api/platform/workspaces/metrics`. */
export interface PlatformWorkspaceMetrics {
  total: number;
  active: number;
  inactive: number;
}

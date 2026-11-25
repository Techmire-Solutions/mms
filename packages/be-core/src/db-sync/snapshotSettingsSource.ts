import type { GlobalSettings } from "@mms/contracts";

/**
 * Branding + global-settings access for the streaming snapshots.
 *
 * Injected by the route (`services/globalSettingsService` and the workspace
 * repository) so `be-core` never imports an app module — the U5 seam of
 * docs/monorepo-migration-plan.md §8 P1b.
 */
export interface SnapshotSettingsSource {
  /** Workspace branding row (or null). */
  getWorkspaceBranding: (tenant: string) => Promise<unknown>;
  /** Workspace global settings row (or null). */
  getWorkspaceGlobalSettings: (tenant: string) => Promise<GlobalSettings | null>;
  /** Client-safe projection of global settings. */
  maskGlobalSettingsForClient: (settings: GlobalSettings) => GlobalSettings;
}

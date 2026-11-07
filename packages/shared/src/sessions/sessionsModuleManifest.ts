import { z } from "zod";
import type { Permission } from "../auth/permissions.js";
import { SESSION_LIFECYCLE_STATES } from "./sessionLifecycle.js";

/** Bulk status update payload schema for Sessions. */
export const sessionsBulkStatusSchema = z
  .object({
    // Bounded like every other bulk endpoint: unbounded ids fan out one read transaction each.
    ids: z.array(z.string().min(1)).min(1).max(500),
    // Only real lifecycle states: a free-form value silently normalizes to `draft`.
    status: z.enum(SESSION_LIFECYCLE_STATES),
    /** Required when `status` is `cancelled` (the same reason rule as the single cancel action). */
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export type SessionsBulkStatusBody = z.infer<typeof sessionsBulkStatusSchema>;

/** Sessions module manifest — aligns with globle1 universal module architecture. */
export const SESSIONS_MODULE_MANIFEST = {
  moduleId: "sessions",
  entityType: "Session",
  collectionKey: "sessions",
  /** Legacy remap / backup key — typed field-config lives on `session_field_configs`. */
  settingsObjectKey: "sessions_settings",
  configObjectKey: "session_field_config",
  preferencesObjectKey: "session_module_preferences",
  columnPreferencesObjectKey: "session_user_column_preferences",
  restBasePath: "/api/sessions",
  analyticsCategory: "sessions",
  tiers: ["work", "reports", "setup"] as const,
  setupSubTabs: ["categories", "programs", "subjects", "terminology", "preferences"] as const,
  permissions: {
    // Sessions owns its own permission family. Mapping these to `enrollments.*` let an
    // enrollment-only writer create/archive sessions while a `sessions.read` role was denied.
    read: "sessions.read",
    write: "sessions.write",
    delete: "sessions.delete",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    overrideLock: "sessions.override_lock",
    export: "sessions.read",
    reports: "sessions.read",
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ["table", "cards"] as const,
    bulkActions: ["export", "status", "delete"] as const,
  },
  defaultExportFilename: "sessions.csv",
  /** Server CSV export page-walk size (rows per streamed chunk). */
  exportChunkSize: 100,
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    exportsIncludeDeleted: false,
    captureDeletionReason: true,
    retentionDays: null,
  },
  defaultPageSize: 12,
  maxPageSize: 100,
} as const;

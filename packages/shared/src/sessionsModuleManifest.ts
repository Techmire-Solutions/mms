import { z } from 'zod';
import type { Permission } from './permissions.js';

/** Bulk status update payload schema for Sessions. */
export const sessionsBulkStatusSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1),
    status: z.string().min(1),
  })
  .strict();

export type SessionsBulkStatusBody = z.infer<typeof sessionsBulkStatusSchema>;

/** Sessions module manifest — aligns with globle1 universal module architecture. */
export const SESSIONS_MODULE_MANIFEST = {
  moduleId: 'sessions',
  entityType: 'Session',
  collectionKey: 'sessions',
  /** Legacy remap / backup key — typed field-config lives on `session_field_configs`. */
  settingsObjectKey: 'sessions_settings',
  configObjectKey: 'session_field_config',
  preferencesObjectKey: 'session_module_preferences',
  columnPreferencesObjectKey: 'session_user_column_preferences',
  restBasePath: '/api/sessions',
  analyticsCategory: 'sessions',
  tiers: ['work', 'reports', 'setup'] as const,
  setupSubTabs: ['categories', 'programs', 'subjects', 'terminology', 'preferences'] as const,
  permissions: {
    read: 'enrollments.read',
    write: 'enrollments.write',
    delete: 'enrollments.write',
    setupView: 'configuration.view',
    setupWrite: 'settings.global.write',
    export: 'enrollments.read',
    reports: 'enrollments.read',
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ['table', 'cards'] as const,
    bulkActions: ['export', 'status', 'delete'] as const,
  },
  defaultExportFilename: 'sessions.csv',
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

export type SessionsModuleTier = (typeof SESSIONS_MODULE_MANIFEST.tiers)[number];

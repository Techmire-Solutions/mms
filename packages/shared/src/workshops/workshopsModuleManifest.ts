import { z } from "zod";
import type { Permission } from "../auth/permissions.js";

/** Workshops module manifest — events with registration, per-day check-in and scores. */
export const WORKSHOPS_MODULE_MANIFEST = {
  moduleId: "workshops",
  entityType: "Workshop",
  collectionKey: "workshop_events",
  participantCollectionKey: "workshop_participants",
  attendanceCollectionKey: "workshop_attendance",
  scoreCollectionKey: "workshop_scores",
  columnPreferencesObjectKey: "workshop_user_column_preferences",
  restBasePath: "/api/workshops",
  analyticsCategory: "workshops",
  tiers: ["work", "reports", "setup"] as const,
  setupSubTabs: ["preferences"] as const,
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    exportsIncludeDeleted: false,
    captureDeletionReason: false,
    retentionDays: null,
  },
  permissions: {
    read: "workshops.read",
    write: "workshops.write",
    delete: "workshops.delete",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    export: "workshops.read",
    reports: "workshops.read",
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ["table", "cards"] as const,
    bulkActions: ["delete"] as const,
  },
  defaultPageSize: 15,
  maxPageSize: 100,
} as const;

export type WorkshopsModuleTier = (typeof WORKSHOPS_MODULE_MANIFEST.tiers)[number];

/** Command-centre counts; "upcoming"/"ongoing"/"finished" are relative to the server's today. */
export const workshopsCommandMetricsSnapshotSchema = z
  .object({
    total: z.number().int(),
    upcoming: z.number().int(),
    ongoing: z.number().int(),
    finished: z.number().int(),
    participants: z.number().int(),
  })
  .strict();

export type WorkshopsCommandMetricsSnapshot = z.infer<typeof workshopsCommandMetricsSnapshotSchema>;

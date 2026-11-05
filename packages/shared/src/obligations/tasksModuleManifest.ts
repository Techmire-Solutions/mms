/**
 * @file tasksModuleManifest.ts
 * @description Manifest, DTO schemas, and types for the Tasks management module.
 */

import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "completed",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * Legal workflow edges for a status change. The same status is a no-op and is
 * not listed. `completed → in_progress` and `cancelled → todo` are explicit
 * reopens (the UI asks for them through the status menu, never a one-click cycle).
 */
export const TASK_STATUS_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  todo: ["in_progress", "blocked", "cancelled"],
  in_progress: ["in_review", "blocked", "completed", "cancelled"],
  in_review: ["in_progress", "completed", "cancelled"],
  blocked: ["todo", "in_progress", "cancelled"],
  completed: ["in_progress"],
  cancelled: ["todo"],
};

/** Statuses reachable from `status` (empty for an unknown value). */
export function taskStatusTransitionsFrom(status: TaskStatus): readonly TaskStatus[] {
  return TASK_STATUS_TRANSITIONS[status] ?? [];
}

export function isTaskStatusTransitionAllowed(from: TaskStatus, to: TaskStatus): boolean {
  return from === to || taskStatusTransitionsFrom(from).includes(to);
}

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const DELEGATION_SCOPES = ["descendants", "direct_reports"] as const;
export type DelegationScope = (typeof DELEGATION_SCOPES)[number];

export const taskAssigneeRecordSchema = z
  .object({
    id: z.string().min(1),
    taskId: z.string().min(1),
    facultyId: z.string().min(1),
    facultyAssignmentId: z.string().min(1).nullable().optional(),
    userId: z.string().min(1),
    facultyName: z.string().optional(),
    userEmail: z.string().optional(),
    assignedAt: z.string().or(z.date()).optional(),
  })
  .strict();

export type TaskAssigneeRecord = z.infer<typeof taskAssigneeRecordSchema>;

export const taskRecordSchema = z
  .object({
    id: z.string().min(1),
    workspaceSubdomain: z.string(),
    title: z.string().min(1).max(255),
    description: z.string().nullable().optional(),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(TASK_PRIORITIES),
    startDate: z.string().nullable().optional(),
    dueAt: z.string().or(z.date()).nullable().optional(),
    parentTaskId: z.string().min(1).nullable().optional(),
    createdById: z.string().min(1).nullable().optional(),
    creatorName: z.string().optional(),
    assignees: z.array(taskAssigneeRecordSchema).optional().default([]),
    createdAt: z.string().or(z.date()).optional(),
    updatedAt: z.string().or(z.date()).optional(),
    deletedAt: z.string().or(z.date()).nullable().optional(),
  })
  .strict();

export type TaskRecord = z.infer<typeof taskRecordSchema>;

export const taskAssigneeInputSchema = z
  .object({
    facultyId: z.string().min(1),
    facultyAssignmentId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
  })
  .strict();

export type TaskAssigneeInput = z.infer<typeof taskAssigneeInputSchema>;

export const taskInsertSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(255),
    description: z.string().trim().max(5000).optional(),
    status: z.enum(TASK_STATUSES).default("todo"),
    priority: z.enum(TASK_PRIORITIES).default("medium"),
    startDate: isoDateSchema.nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
    parentTaskId: z.string().min(1).nullable().optional(),
    assignees: z.array(taskAssigneeInputSchema).max(100).optional().default([]),
  })
  .strict();

export type TaskInsert = z.infer<typeof taskInsertSchema>;

export const taskUpdateSchema = taskInsertSchema.partial().extend({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignees: z.array(taskAssigneeInputSchema).max(100).optional(),
});
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;

export const taskStatusUpdateSchema = z
  .object({
    status: z.enum(TASK_STATUSES),
  })
  .strict();

export type TaskStatusUpdate = z.infer<typeof taskStatusUpdateSchema>;

export const tasksBulkStatusBodySchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(500),
    status: z.enum(TASK_STATUSES),
  })
  .strict();

export type TasksBulkStatusBody = z.infer<typeof tasksBulkStatusBodySchema>;

export const taskListQuerySchema = z
  .object({
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assignedToFacultyId: z.string().optional(),
    assignedToUserId: z.string().min(1).optional(),
    createdById: z.string().min(1).optional(),
    search: z.string().optional(),
    dueFrom: z.string().max(32).optional(),
    dueTo: z.string().max(32).optional(),
    /** Comma-separated statuses for multi-select quick filters (`todo,in_progress`). */
    statuses: z.string().max(200).optional(),
    /** Comma-separated priorities for multi-select quick filters (`high,urgent`). */
    priorities: z.string().max(200).optional(),
    /** Only tasks past due and not completed/cancelled. */
    overdue: z
      .union([z.boolean(), z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v === true || v === "true"),
    /** Due on this ISO day (inclusive UTC-day range). */
    dueOn: z.string().max(32).optional(),
    /** Comma-separated task ids for selection-scoped exports. */
    ids: z.string().max(20_000).optional(),
    includeDeleted: z
      .union([z.boolean(), z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v === true || v === "true"),
    limit: z.coerce.number().int().min(1).max(500).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type TaskListQuery = z.infer<typeof taskListQuerySchema>;

export const taskSettingsSchema = z
  .object({
    delegationScope: z.enum(DELEGATION_SCOPES).default("descendants"),
    allowSelfAssignment: z.boolean().default(true),
    notifyOnAssignment: z.boolean().default(true),
    notifyOnStatusChange: z.boolean().default(true),
  })
  .strict();

export type TaskSettings = z.infer<typeof taskSettingsSchema>;

export const DEFAULT_TASK_SETTINGS: TaskSettings = {
  delegationScope: "descendants",
  allowSelfAssignment: true,
  notifyOnAssignment: true,
  notifyOnStatusChange: true,
};

export const tasksCommandMetricsSnapshotSchema = z
  .object({
    total: z.number().int().min(0),
    todo: z.number().int().min(0),
    inProgress: z.number().int().min(0),
    inReview: z.number().int().min(0),
    blocked: z.number().int().min(0),
    completed: z.number().int().min(0),
    cancelled: z.number().int().min(0),
    overdue: z.number().int().min(0),
    byPriority: z
      .object({
        low: z.number().int().min(0),
        medium: z.number().int().min(0),
        high: z.number().int().min(0),
        urgent: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export type TasksCommandMetricsSnapshot = z.infer<typeof tasksCommandMetricsSnapshotSchema>;

export const TASKS_MODULE_MANIFEST = {
  moduleId: "tasks",
  entityType: "Task",
  collectionKey: "tasks",
  settingsObjectKey: "tasks_settings",
  preferencesObjectKey: "tasks_module_preferences",
  columnPreferencesObjectKey: "tasks_user_column_preferences",
  restBasePath: "/api/tasks",
  analyticsCategory: "tasks",
  tiers: ["work", "reports", "setup"] as const,
  setupSubTabs: ["preferences"] as const,
  permissions: {
    read: "tasks.read",
    write: "tasks.write",
    delete: "tasks.delete",
    assign: "tasks.assign",
    assignAnywhere: "tasks.assign_anywhere",
    complete: "tasks.complete",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    reports: "tasks.read",
  },
  work: {
    directoryViews: ["table", "cards"] as const,
    bulkActions: ["delete"] as const,
  },
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    exportsIncludeDeleted: false,
    captureDeletionReason: false,
    retentionDays: null,
  },
  defaultPageSize: 50,
  maxPageSize: 100,
} as const;

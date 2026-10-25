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

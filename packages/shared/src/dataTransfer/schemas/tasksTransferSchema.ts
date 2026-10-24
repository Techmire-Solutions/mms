/**
 * @file tasksTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Tasks.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface TaskTransferEntity {
  title: string;
  assignee?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  description?: string;
  notes?: string;
}

export const tasksTransferSchema: ModuleTransferSchema<TaskTransferEntity> =
  createModuleTransferSchema<TaskTransferEntity>({
    moduleId: "tasks",
    entityNounPlural: "tasks",
    defaultFilename: "tasks.csv",
    fields: [
      {
        key: "title",
        label: "Task Title",
        aliases: ["task", "Title", "Subject"],
        required: true,
        sample: "Prepare Term 1 Exam Schedule",
        extract: (t) => t.title || "",
      },
      {
        key: "assignee",
        label: "Assigned User",
        aliases: ["assigned_to", "Owner", "User"],
        sample: "Shaykh Ahmad",
        extract: (t) => t.assignee || "",
      },
      {
        key: "priority",
        label: "Priority",
        aliases: ["Urgency", "Level"],
        sample: "high",
        extract: (t) => t.priority || "medium",
      },
      {
        key: "status",
        label: "Status",
        aliases: ["task_status", "State"],
        sample: "in_progress",
        extract: (t) => t.status || "todo",
      },
      {
        key: "dueDate",
        label: "Due Date",
        aliases: ["due_date", "Deadline"],
        sample: "2024-10-15",
        extract: (t) => t.dueDate || "",
      },
      {
        key: "description",
        label: "Description",
        aliases: ["details", "Summary"],
        sample: "Coordinate with department heads and publish by Monday",
        extract: (t) => t.description || "",
      },
      {
        key: "notes",
        label: "Notes / Comments",
        aliases: ["remarks"],
        sample: "Pending room availability confirmation",
        extract: (t) => t.notes || "",
      },
    ],
  });

registerModuleTransferSchema(tasksTransferSchema);

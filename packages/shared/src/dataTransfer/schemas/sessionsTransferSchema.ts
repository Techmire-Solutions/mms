/**
 * @file sessionsTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Sessions.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";
import type { z } from "zod";
import type { sessionImportRowSchema, SessionsImportBody } from "../../schemas/moduleImport.dto.js";

/** Import row SSOT: the CSV entity is inferred from the validated import schema. */
export type SessionTransferEntity = z.infer<typeof sessionImportRowSchema>;
export type SessionTransferBody = SessionsImportBody;

export const sessionsTransferSchema: ModuleTransferSchema<SessionTransferEntity> =
  createModuleTransferSchema<SessionTransferEntity>({
    moduleId: "sessions",
    entityNounPlural: "sessions",
    defaultFilename: "sessions.csv",
    fields: [
      {
        key: "name",
        label: "Session Name",
        aliases: ["Name", "session_name", "Title"],
        required: true,
        sample: "Academic Year 2024-2025",
        extract: (s) => s.name || "",
      },
      {
        key: "type",
        label: "Session Type",
        aliases: ["type", "session_type", "Kind"],
        required: true,
        sample: "regular",
        extract: (s) => s.type || "",
      },
      {
        key: "status",
        label: "Status",
        aliases: ["Session Status"],
        sample: "active",
        extract: (s) => s.status || "active",
      },
      {
        key: "startDate",
        label: "Start Date",
        aliases: ["start_date", "Beginning"],
        sample: "2024-08-15",
        extract: (s) => s.startDate || "",
      },
      {
        key: "endDate",
        label: "End Date",
        aliases: ["end_date", "Ending"],
        sample: "2025-06-30",
        extract: (s) => s.endDate || "",
      },
      {
        key: "duration",
        label: "Duration",
        aliases: ["length", "Period"],
        sample: "10 months",
        extract: (s) => s.duration || "",
      },
      {
        key: "baseFee",
        label: "Base Fee",
        aliases: ["base_fee", "Fee", "Tuition"],
        sample: "15000",
        extract: (s) => (s.baseFee != null ? String(s.baseFee) : ""),
      },
      {
        key: "currency",
        label: "Currency",
        aliases: ["curr"],
        sample: "PKR",
        extract: (s) => s.currency || "PKR",
      },
      {
        key: "capacity",
        label: "Capacity",
        aliases: ["max_students", "Seats"],
        sample: 120,
        extract: (s) => (s.capacity != null ? s.capacity : ""),
        parse: (raw) => (raw ? Number(raw) : undefined),
      },
      {
        key: "description",
        label: "Description",
        aliases: ["details", "Summary"],
        sample: "Annual primary madrasa program",
        extract: (s) => s.description || "",
      },
      {
        key: "notes",
        label: "Notes",
        aliases: ["Remarks"],
        sample: "Subsidized boarding available",
        extract: (s) => s.notes || "",
      },
    ],
  });

registerModuleTransferSchema(sessionsTransferSchema);

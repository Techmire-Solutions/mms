/**
 * @file attendanceTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Attendance.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface AttendanceTransferEntity {
  date: string;
  personName: string;
  personType?: string;
  sessionName?: string;
  className?: string;
  status: string;
  notes?: string;
}

export const attendanceTransferSchema: ModuleTransferSchema<AttendanceTransferEntity> =
  createModuleTransferSchema<AttendanceTransferEntity>({
    moduleId: "attendance",
    entityNounPlural: "attendance records",
    defaultFilename: "attendance.csv",
    fields: [
      {
        key: "date",
        label: "Attendance Date",
        aliases: ["date", "Day"],
        required: true,
        sample: "2024-09-02",
        extract: (a) => a.date || "",
      },
      {
        key: "personName",
        label: "Person Name",
        aliases: ["student_name", "Student", "Member", "Name"],
        required: true,
        sample: "Ali ibn Husayn",
        extract: (a) => a.personName || "",
      },
      {
        key: "personType",
        label: "Person Type",
        aliases: ["role", "Type"],
        sample: "student",
        extract: (a) => a.personType || "student",
      },
      {
        key: "sessionName",
        label: "Session",
        aliases: ["session", "Academic Year"],
        sample: "Academic Year 2024-2025",
        extract: (a) => a.sessionName || "",
      },
      {
        key: "className",
        label: "Class / Section",
        aliases: ["class", "Section"],
        sample: "Hifz Section A",
        extract: (a) => a.className || "",
      },
      {
        key: "status",
        label: "Status",
        aliases: ["attendance_status", "State"],
        required: true,
        sample: "present",
        extract: (a) => a.status || "present",
      },
      {
        key: "notes",
        label: "Excuse / Notes",
        aliases: ["remarks", "Reason"],
        sample: "Attended on time",
        extract: (a) => a.notes || "",
      },
    ],
  });

registerModuleTransferSchema(attendanceTransferSchema);

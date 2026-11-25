/**
 * @file academicCalendarTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data-transfer schema for the Attendance
 * academic calendar (holidays / make-up days / exam periods / events).
 */
import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface AcademicCalendarTransferEntity {
  title: string;
  kind: string;
  startOn: string;
  endOn: string;
  scope: string;
  sessionId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  notes?: string | null;
}

export const academicCalendarTransferSchema: ModuleTransferSchema<AcademicCalendarTransferEntity> =
  createModuleTransferSchema<AcademicCalendarTransferEntity>({
    moduleId: "attendance-calendar",
    entityNounPlural: "academic calendar events",
    defaultFilename: "academic-calendar.csv",
    fields: [
      {
        key: "title",
        label: "Event Title",
        required: true,
        sample: "Eid al-Fitr Holiday",
      },
      {
        key: "kind",
        label: "Event Kind",
        required: true,
        sample: "holiday",
      },
      {
        key: "startOn",
        label: "Start Date",
        required: true,
        sample: "2025-03-30",
      },
      {
        key: "endOn",
        label: "End Date",
        required: true,
        sample: "2025-04-01",
      },
      {
        key: "scope",
        label: "Scope",
        required: true,
        sample: "workspace",
      },
      { key: "sessionId", label: "Session ID", sample: "" },
      { key: "classId", label: "Class ID", sample: "" },
      { key: "sectionId", label: "Section ID", sample: "" },
      { key: "notes", label: "Notes", sample: "" },
    ],
  });

registerModuleTransferSchema(academicCalendarTransferSchema);

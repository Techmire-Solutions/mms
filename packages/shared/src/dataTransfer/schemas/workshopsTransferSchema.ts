/**
 * @file workshopsTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data-transfer schema for Workshops (events).
 */
import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface WorkshopsTransferEntity {
  title: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  registrationDeadline?: string | null;
  capacity?: number | null;
  fee?: number | null;
  programId?: string | null;
  subjectId?: string | null;
  minAttendancePct?: number | null;
  minScorePct?: number | null;
  participantCount?: number;
  waitlistEnabled?: boolean;
  status?: string;
  phase?: string;
}

export const workshopsTransferSchema: ModuleTransferSchema<WorkshopsTransferEntity> =
  createModuleTransferSchema<WorkshopsTransferEntity>({
    moduleId: "workshops",
    entityNounPlural: "workshops",
    defaultFilename: "workshops.csv",
    fields: [
      { key: "title", label: "Title", required: true, sample: "Summer Hifz Intensive" },
      { key: "description", label: "Description", sample: "Weekday hifz revision programme" },
      { key: "startDate", label: "Start Date", sample: "2025-07-01" },
      { key: "endDate", label: "End Date", sample: "2025-07-31" },
      { key: "registrationDeadline", label: "Registration Deadline", sample: "2025-06-25" },
      { key: "capacity", label: "Capacity", sample: "40" },
      { key: "fee", label: "Fee", sample: "1500" },
      { key: "programId", label: "Program ID", sample: "" },
      { key: "subjectId", label: "Subject ID", sample: "" },
      { key: "minAttendancePct", label: "Min Attendance %", sample: "75" },
      { key: "minScorePct", label: "Min Score %", sample: "60" },
      { key: "participantCount", label: "Participants", sample: "12" },
      { key: "waitlistEnabled", label: "Waitlist Enabled", sample: "No" },
      { key: "status", label: "Status", sample: "open" },
      { key: "phase", label: "Phase", sample: "registration" },
    ],
  });

registerModuleTransferSchema(workshopsTransferSchema);

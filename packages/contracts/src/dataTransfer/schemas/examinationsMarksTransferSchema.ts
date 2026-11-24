import { createModuleTransferSchema, type ModuleTransferSchema } from "../index.js";

export interface ExaminationMarksTransferEntity {
  rollNumber?: string;
  marksObtained?: number | string;
}

/**
 * Marks-import column contract (the dialog reads this to build its template and mappings).
 *
 * Deliberately not registered in the module transfer registry: "examinations" is already the
 * metadata schema, and one module cannot own two templates. The dialog receives this object
 * directly instead of looking it up by module id.
 */
export const examinationsMarksTransferSchema: ModuleTransferSchema<ExaminationMarksTransferEntity> =
  createModuleTransferSchema<ExaminationMarksTransferEntity>({
    moduleId: "examinations_marks",
    entityNounPlural: "marks",
    defaultFilename: "examination-marks.csv",
    fields: [
      {
        key: "rollNumber",
        label: "Roll Number",
        aliases: ["roll_no", "Roll No", "Student ID"],
        required: true,
        sample: "EX-1092",
        extract: (row) => row.rollNumber || "",
      },
      {
        key: "marksObtained",
        label: "Marks Obtained",
        aliases: ["marks", "Marks", "Score"],
        required: true,
        sample: 85,
        extract: (row) => (row.marksObtained != null ? String(row.marksObtained) : ""),
        parse: (raw) => (raw ? Number(raw) : undefined),
      },
    ],
  });

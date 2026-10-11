/**
 * @file facultyDesignationTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Faculty Designations.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";
import type { FacultyDesignationCsvRow } from "../../facultyDesignationCsvParser.js";

export const facultyDesignationTransferSchema: ModuleTransferSchema<FacultyDesignationCsvRow> =
  createModuleTransferSchema<FacultyDesignationCsvRow>({
    moduleId: "faculty-designations",
    entityNounPlural: "designations",
    defaultFilename: "faculty-designations_import_template.csv",
    fields: [
      {
        key: "department",
        label: "Department",
        aliases: ["department_name", "departmentname"],
        required: true,
        sample: "Islamic Studies",
        extract: (d) => d.department || "",
      },
      {
        key: "name",
        label: "Designation Name",
        aliases: ["designation", "name"],
        required: true,
        sample: "Senior Lecturer",
        extract: (d) => d.name || "",
      },
      {
        key: "parentDesignation",
        label: "Parent Designation",
        aliases: ["parent_designation", "parent"],
        sample: "Department Chair",
        extract: (d) => d.parentDesignation || "",
      },
      {
        key: "status",
        label: "Status",
        aliases: ["active", "is_active"],
        sample: "active",
        extract: (d) => d.status || "active",
      },
    ],
  });

registerModuleTransferSchema(facultyDesignationTransferSchema);

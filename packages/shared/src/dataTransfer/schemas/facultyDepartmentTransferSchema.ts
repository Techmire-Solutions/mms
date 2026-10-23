/**
 * @file facultyDepartmentTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Faculty Departments.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";
import type { FacultyDepartmentCsvRow } from "../../faculty/facultyDepartmentCsvParser.js";

export const facultyDepartmentTransferSchema: ModuleTransferSchema<FacultyDepartmentCsvRow> =
  createModuleTransferSchema<FacultyDepartmentCsvRow>({
    moduleId: "faculty-departments",
    entityNounPlural: "departments",
    defaultFilename: "faculty-departments_import_template.csv",
    fields: [
      {
        key: "name",
        label: "Department Name",
        aliases: ["department", "departmentname", "name"],
        required: true,
        sample: "Arabic Language & Literature",
        extract: (d) => d.name || "",
      },
      {
        key: "description",
        label: "Description",
        aliases: ["desc", "details"],
        sample: "Quranic Arabic, grammar, and rhetoric",
        extract: (d) => d.description || "",
      },
      {
        key: "status",
        label: "Status",
        aliases: ["active", "is_active", "isactive"],
        sample: "active",
        extract: (d) => d.status || "active",
      },
    ],
  });

registerModuleTransferSchema(facultyDepartmentTransferSchema);

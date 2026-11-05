import { createModuleImportService } from "../lib/createModuleImportService.js";
import { studentImportRowSchema } from "@mms/shared";
import { importStudentRows, type StudentImportRow } from "./use-cases/studentImportUseCases.js";

/**
 * Students CSV import service.
 *
 * `POST /api/students/import` enqueues a `students:import` background job; without a registered
 * runner every import failed with "No runner registered for students:import". The runner is
 * registered from `registerDefaultBackgroundJobRunners` for both the API and worker processes.
 */
export const studentsImportService = createModuleImportService<StudentImportRow>({
  moduleId: "students",
  entityNounPlural: "students",
  spec: { rowSchema: studentImportRowSchema, maxBatch: 200 },
  persist: (rows, ctx) => importStudentRows(rows, ctx),
});

/** Registers the `students:import` job runner (idempotent per process). */
export function registerStudentsImportJobRunner(): void {
  studentsImportService.registerJobRunner();
}

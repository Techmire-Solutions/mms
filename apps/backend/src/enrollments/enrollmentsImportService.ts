import { enrollmentImportRowSchema } from "@mms/shared";
import { createModuleImportService } from "../lib/createModuleImportService.js";
import {
  importEnrollmentRows,
  type EnrollmentImportRow,
} from "./use-cases/enrollmentImportUseCases.js";

/**
 * Enrollments CSV import service.
 *
 * `POST /api/enrollments/import` enqueues an `enrollments:import` background job. Without this
 * runner the worker failed every import with "No runner registered for enrollments:import"
 * while the route had already answered 202. Batch size is smaller than the 500-row body cap so
 * a shutdown/deadline can stop between chunks and a retry resumes idempotently.
 */
export const enrollmentsImportService = createModuleImportService<EnrollmentImportRow>({
  moduleId: "enrollments",
  entityNounPlural: "enrollments",
  spec: { rowSchema: enrollmentImportRowSchema, maxBatch: 100 },
  persist: importEnrollmentRows,
});

/** Registers the `enrollments:import` job runner (idempotent per process). */
export function registerEnrollmentsImportJobRunner(): void {
  enrollmentsImportService.registerJobRunner();
}

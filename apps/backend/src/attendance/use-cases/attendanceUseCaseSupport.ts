import { HttpDomainError } from "../../lib/httpErrors.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import type { AttendanceRepository } from "../repository/attendanceRepository.js";
import type { createGenericRelationalService } from "../../services/genericRelationalService.js";
import type { AttendanceRecord } from "@mms/shared";
import type { AttendancePolicyStore } from "./attendancePolicyGuard.js";

/** Shared plumbing for the attendance write use-cases. */

export type AttendanceGenericCrud = ReturnType<
  typeof createGenericRelationalService<AttendanceRecord>
>;

export interface AttendanceMutationDeps {
  repo: AttendanceRepository;
  crud: AttendanceGenericCrud;
  /** Policy lookups; injected by the composition root so tests can run without a database. */
  policyStore?: AttendancePolicyStore;
  validateActiveForeignKeys: (tenant: string, record: Partial<AttendanceRecord>) => Promise<void>;
  validateBatchActiveForeignKeys: (tenant: string, rows: AttendanceRecord[]) => Promise<void>;
}

export function requireTenant(): string {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  return tenant;
}

/** A stale roster must not be able to record attendance for a non-enrolled student. */
export function notEnrolled(rejected: {
  studentId: string;
  classId: string;
  date: string;
}): HttpDomainError {
  return new HttpDomainError(
    422,
    "attendance_not_enrolled",
    `Student ${rejected.studentId} has no enrollment in this class on ${rejected.date} — refresh the roster`,
  );
}

import type { FacultyRecord } from "@mms/shared";
import type { FacultyWriteGuards } from "./facultyWriteHelpers.js";
import type { FacultyContactRequirements } from "./facultyWriteGuards.js";

export interface CreateFacultyResult {
  record: FacultyRecord;
  /** True when an archived faculty member with the same contactId was restored instead of inserting. */
  restored: boolean;
}

/** Thrown when a create would un-delete an archived faculty member without delete permission. */
export class FacultyPermissionError extends Error {
  readonly statusCode = 403;
  readonly type = "forbidden";
  constructor(message = "Restoring an archived faculty member requires delete permission") {
    super(message);
    this.name = "FacultyPermissionError";
  }
}

/**
 * Batch writers (CSV import) pass one collector so contact-tag reconciliation
 * and the live-push broadcast run once after the loop instead of per row.
 * See `mms-code-review.md` §8 (batch writers) and `mms-data-layer.md` §9.
 */
export interface FacultyBatchSideEffects {
  contactIds: Set<string>;
}

export interface CreateFacultyOptions {
  /** Acting user id stamped on the row and the audit trail. */
  actorId?: string;
  /** False when the caller lacks `faculty.delete`; blocks implicit restore. */
  canRestore?: boolean;
  /**
   * Batch writers pass an intentional employee id per row; skipping the
   * preview probe saves one read per record.
   */
  skipEmployeeIdPreview?: boolean;
  /** DI seam for the DB-backed link guards (unit tests pass fakes). */
  guards?: FacultyWriteGuards;
  /** Present on batch writes: defers reconcile + broadcast to the caller. */
  batch?: FacultyBatchSideEffects;
  /** Preloaded contact-eligibility requirements; batch writers load once and reuse. */
  contactRequirements?: FacultyContactRequirements;
}

/** Options for the single-record update path (batch deferred side effects optional). */
export interface UpdateFacultyOptions {
  /** Acting user id stamped on the row and the audit trail. */
  actorId?: string;
  guards?: FacultyWriteGuards;
  /** Present on batch writes: defers reconcile + broadcast to the caller. */
  batch?: FacultyBatchSideEffects;
  /** `updatedAt` the client read — enforces the 409 compare-and-set path. */
  expectedUpdatedAt?: string;
  /** Preloaded contact-eligibility requirements; batch writers load once and reuse. */
  contactRequirements?: FacultyContactRequirements;
}

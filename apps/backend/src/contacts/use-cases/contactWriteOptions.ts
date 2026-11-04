import type { User } from "@mms/shared";
import type { ContactWriteContext } from "./contactWriteContextTypes.js";

/**
 * Options accepted by the contact write use cases.
 *
 * Kept out of the orchestration module (`contactWriteUseCases.ts`) so its
 * transaction body stays inside the 300-line ceiling; the types are the input
 * contract shared by routes, the import worker and Google sync.
 */
export interface UpsertContactOptions {
  user?: User;
  canRestore?: boolean;
  language?: string;
  actorId?: string;
  viewerRole?: string;
  context?: ContactWriteContext;
  /** HTTP create: existing id without expectedUpdatedAt conflicts. */
  requireExpectedVersion?: boolean;
  expectedUpdatedAt?: string;
  /** Batch mode: caller invalidates cache/broadcasts after loop. */
  batchMode?: boolean;
}

export interface UpdateContactByIdOptions {
  language?: string;
  /**
   * When false, skip peer relationship graph writes.
   * Required for self-service profile updates without `contacts.write`.
   * @default true
   */
  applyRelationshipInference?: boolean;
  /** Acting user — stamped into `updated_by`; never taken from the payload. */
  actorId?: string;
  /**
   * Optimistic concurrency: the `updatedAt` the client based its edit on.
   * A mismatch means another writer saved first → `ConflictError` (409).
   */
  expectedUpdatedAt?: string;
  /** Acting role for the read/write field-permission guard. */
  viewerRole?: string;
  /** Preloaded tenant config (batch writers). */
  context?: ContactWriteContext;
}

import { studentStatusEndsEnrollments, type StudentRecord, type User } from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { runInTransaction } from "../../db/database.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { ConflictError } from "../../lib/httpErrors.js";
import type { StudentsRepository } from "../repository/studentsRepository.js";
import { studentsRepository } from "../repository/studentsRepositoryAdapter.js";
import {
  mergeStudentPatch,
  prepareStudentRecord,
  throwGrUniqueConflict,
  StudentCreateIdConflictError,
} from "./studentNormalizeUseCases.js";
import { readSuppliedStudentId, resolveStudentIdCollision } from "./studentCreateGuard.js";
import { loadStudentModulePreferences } from "./studentPreferencesService.js";
import { reconcileContactSystemTags } from "../../contacts/systemTags/contactSystemTagUseCases.js";
import { withdrawEnrollmentsForStudentStatus } from "../../enrollments/use-cases/enrollmentEndUseCases.js";
import { buildStudentStatusActor } from "./studentStatusTransitionUseCases.js";
import { invalidateStudentsCache } from "./studentCacheInvalidation.js";
import { restoreArchivedStudentOnCreate } from "./studentRestoreOnCreate.js";
import { appendCollectionAuditInTx } from "../../lib/collectionAuditInTx.js";

interface CreateStudentResult {
  record: StudentRecord;
  /** True when an archived student with the same contactId was restored instead of inserting. */
  restored: boolean;
}

const STUDENT_VERSION_CONFLICT =
  "This student was changed by someone else. Reload it and try again.";

interface CreateStudentOptions {
  user?: User;
  /** Background jobs have no session user; the acting user id is still stamped. */
  actorId?: string;
  /** Batch callers (CSV import) broadcast once per chunk instead of live-pushing per row. */
  deferBroadcast?: boolean;
}

/**
 * Creates a student.
 *
 * A client-supplied `id` is honoured only when it is unused. Students persist through an upsert
 * keyed on `(workspace_subdomain, id)`, so adopting an existing id would overwrite that row: an id
 * owned by an active student is rejected with a 409, and an id owned by a soft-deleted student is
 * restored in place through the same delete-permission-gated path as a re-registration by
 * `contactId` (Contacts restore-on-create parity).
 */
export async function createStudent(
  record: StudentRecord | Record<string, unknown>,
  options: CreateStudentOptions | User = {},
  repo: StudentsRepository = studentsRepository,
): Promise<CreateStudentResult> {
  const result = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) throw new Error("Tenant context required");
    const normalized = prepareStudentRecord(record);
    const suppliedId = readSuppliedStudentId((record ?? {}) as Record<string, unknown>);
    const contactId = normalized.contactId != null ? String(normalized.contactId).trim() : "";

    const user =
      options && "role" in options ? (options as User) : (options as CreateStudentOptions)?.user;
    const userId = user?.id
      ? String(user.id)
      : options && "actorId" in options
        ? (options as CreateStudentOptions).actorId
        : undefined;
    // Attribution is stamped from the session, never from the payload.
    if (userId) {
      normalized.createdBy = userId;
      normalized.updatedBy = userId;
    }

    if (suppliedId) {
      const collision = await resolveStudentIdCollision(repo, tenant, suppliedId);
      if (collision.kind === "active") throw new StudentCreateIdConflictError();
      if (collision.kind === "archived" && collision.student) {
        const merged = await restoreArchivedStudentOnCreate({
          tenant,
          archived: collision.student,
          incoming: normalized,
          user,
          userId,
          repo,
        });
        return { record: merged, restored: true };
      }
    }

    if (contactId) {
      const archived = await repo.findSoftDeletedByContactId(tenant, contactId);
      if (archived) {
        const merged = await restoreArchivedStudentOnCreate({
          tenant,
          archived,
          incoming: normalized,
          user,
          userId,
          repo,
        });
        return { record: merged, restored: true };
      }
    }

    if (!normalized.grNumber?.trim() && repo.generateNextGrNumber) {
      const prefs = await loadStudentModulePreferences();
      if (!prefs || prefs.autoGenerateId !== false) {
        const regDateStr =
          typeof normalized.registeredDate === "string" && normalized.registeredDate.trim()
            ? normalized.registeredDate.trim()
            : new Date().toISOString().slice(0, 10);
        normalized.grNumber = await repo.generateNextGrNumber(tenant, {
          regDate: regDateStr,
          settings: {
            grNumberTemplate: prefs?.grNumberTemplate ?? "{seq}-{year}",
            grNumberDigits: prefs?.grNumberDigits ?? 4,
            grNumberRestartAnnually: prefs?.grNumberRestartAnnually ?? true,
          },
        });
      }
    }

    try {
      await repo.save(tenant, normalized);
    } catch (error: unknown) {
      throwGrUniqueConflict(error);
    }
    await reconcileContactSystemTags(
      tenant,
      [
        normalized.contactId,
        normalized.fatherContactId,
        normalized.motherContactId,
        normalized.guardianContactId,
      ],
      { actorId: userId },
    );
    // Authoritative audit row commits with the write (mms-data-layer §5.4).
    await appendCollectionAuditInTx({
      tenant,
      tableName: "students",
      recordId: String(normalized.id),
      action: "student.create",
      summary: `Created student ${String(normalized.id)}`,
      realUserId: userId,
      subjectId: String(normalized.id),
    });
    return { record: normalized, restored: false };
  }).finally(invalidateStudentsCache);
  const deferBroadcast = options && !("role" in options) && Boolean(options.deferBroadcast);
  if (!deferBroadcast) await broadcastCollection("students");
  return result;
}

export async function updateStudentById(
  id: string,
  record: StudentRecord | Record<string, unknown>,
  options?:
    { user?: User; userId?: string; expectedUpdatedAt?: string } | User | StudentsRepository,
  repo: StudentsRepository = studentsRepository,
): Promise<StudentRecord | null> {
  const actualRepo =
    options && typeof (options as StudentsRepository).findById === "function"
      ? (options as StudentsRepository)
      : repo;
  const expectedUpdatedAt =
    options && "expectedUpdatedAt" in options
      ? (options as { expectedUpdatedAt?: string }).expectedUpdatedAt?.trim()
      : undefined;
  const user =
    options && "role" in options
      ? (options as User)
      : options && "user" in options
        ? (options as { user?: User }).user
        : undefined;
  const userId = user?.id
    ? String(user.id)
    : options && "userId" in options
      ? (options as { userId?: string }).userId
      : undefined;

  let previousStatus: string | undefined;
  const saved = await runInTransaction(async () => {
    const tenant = getRequestTenant();
    if (!tenant) return null;
    const existing = await actualRepo.findById(tenant, id);
    if (!existing || existing.deletedAt) return null;
    previousStatus = existing.status;
    const patched = mergeStudentPatch(existing, record);
    const normalized = prepareStudentRecord({
      ...patched,
      id,
    });
    if (userId) {
      normalized.updatedBy = userId;
    }
    try {
      if (expectedUpdatedAt) {
        // Optimistic concurrency: the token the caller read must still match the
        // stored `updated_at`, otherwise the edit is a 409 (mms-api-interface §6).
        if (!actualRepo.saveIfVersionMatches) {
          throw new ConflictError(STUDENT_VERSION_CONFLICT);
        }
        const savedWithVersion = await actualRepo.saveIfVersionMatches(
          tenant,
          normalized,
          expectedUpdatedAt,
        );
        if (!savedWithVersion) throw new ConflictError(STUDENT_VERSION_CONFLICT);
      } else {
        await actualRepo.save(tenant, normalized);
      }
    } catch (error: unknown) {
      if (error instanceof ConflictError) throw error;
      throwGrUniqueConflict(error);
    }
    // A status that ends enrollments must withdraw them in the same transaction: the enrollment
    // pipeline releases the seat, offers it to the waitlist and settles withdrawal invoices, and a
    // failure there has to roll the status change back (previously it ran after the commit).
    if (studentStatusEndsEnrollments(previousStatus, normalized.status)) {
      await withdrawEnrollmentsForStudentStatus(
        tenant,
        id,
        String(normalized.status),
        buildStudentStatusActor(user),
      );
    }
    // Reconcile both the previous and the new links so removed roles archive.
    await reconcileContactSystemTags(
      tenant,
      [
        existing.contactId,
        existing.fatherContactId,
        existing.motherContactId,
        existing.guardianContactId,
        normalized.contactId,
        normalized.fatherContactId,
        normalized.motherContactId,
        normalized.guardianContactId,
      ],
      { actorId: userId },
    );
    // Authoritative audit row commits with the write (mms-data-layer §5.4).
    await appendCollectionAuditInTx({
      tenant,
      tableName: "students",
      recordId: id,
      action: "student.update",
      summary: `Updated student ${id}`,
      realUserId: userId,
      subjectId: id,
    });
    return normalized;
  }).finally(invalidateStudentsCache);
  if (saved) await broadcastCollection("students");
  return saved;
}

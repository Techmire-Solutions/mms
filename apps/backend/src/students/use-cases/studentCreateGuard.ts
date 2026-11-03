import type { Student } from "@mms/shared";
import type { StudentsRepository } from "../repository/studentsRepository.js";

/**
 * Reads the client-supplied student id from a create payload.
 *
 * `prepareStudentRecord` always resolves an id (it mints `st-<uuid>` when absent), so the write
 * path cannot tell a supplied id from a generated one — this helper is the only place that can.
 * Returns `""` when the payload carries no usable id.
 */
export function readSuppliedStudentId(record: Record<string, unknown>): string {
  const raw = record.id;
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return "";
}

export type StudentIdCollisionKind = "none" | "active" | "archived";

export interface StudentIdCollision {
  kind: StudentIdCollisionKind;
  /** The row that already owns the id (present for `active` and `archived`). */
  student?: Student;
}

/**
 * Classifies a create-by-id collision before any write.
 *
 * Students persist through an upsert keyed on `(workspace_subdomain, id)`
 * (`studentRepositoryPersist.ts`), so a create that reuses an existing id silently overwrites that
 * row — and a soft-deleted row is resurrected, bypassing the delete-permission restore gate.
 * `createStudent` uses this probe to reject active collisions and route archived collisions through
 * the permission-gated restore path.
 */
export async function resolveStudentIdCollision(
  repo: StudentsRepository,
  tenant: string,
  suppliedId: string,
): Promise<StudentIdCollision> {
  if (!suppliedId || typeof repo.findById !== "function") return { kind: "none" };
  const existing = await repo.findById(tenant, suppliedId, { includeDeleted: true });
  if (!existing) return { kind: "none" };
  return { kind: existing.deletedAt ? "archived" : "active", student: existing };
}

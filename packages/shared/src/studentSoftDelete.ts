import { CLIENT_SOFT_DELETE_KEYS, stripClientSoftDeleteFields } from "./contactSoftDelete.js";
import { filterActiveStudents, isStudentDeleted } from "./studentTypes.js";

/** Client-supplied soft-delete keys for student mutations. */
export const STUDENT_CLIENT_SOFT_DELETE_KEYS = CLIENT_SOFT_DELETE_KEYS;

/** Strip client soft-delete metadata from student create/update payloads. */
export function stripStudentClientSoftDeleteFields<T>(record: T): T {
  const next = stripClientSoftDeleteFields(record);
  if (next && typeof next === "object") {
    delete (next as Record<string, unknown>).deleted;
  }
  return next;
}

export { stripClientSoftDeleteFields } from "./contactSoftDelete.js";

export { isEntityDeleted, filterActiveEntities } from "./softDelete.js";

export { filterActiveStudents, isStudentDeleted };

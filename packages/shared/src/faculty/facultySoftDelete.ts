import {
  CLIENT_SOFT_DELETE_KEYS,
  stripClientSoftDeleteFields,
} from "../contacts/contactSoftDelete.js";

/** Client-supplied soft-delete keys for faculty mutations. */
export const FACULTY_CLIENT_SOFT_DELETE_KEYS = CLIENT_SOFT_DELETE_KEYS;

/** Strip client soft-delete metadata from faculty create/update payloads. */
export function stripFacultyClientSoftDeleteFields<T>(record: T): T {
  const next = stripClientSoftDeleteFields(record);
  if (next && typeof next === "object") {
    delete (next as Record<string, unknown>).deleted;
  }
  return next;
}

export { stripClientSoftDeleteFields } from "../contacts/contactSoftDelete.js";

export { isEntityDeleted, filterActiveEntities } from "../core/softDelete.js";

export { filterActiveFaculty, isFacultyDeleted } from "./facultyTypes.js";

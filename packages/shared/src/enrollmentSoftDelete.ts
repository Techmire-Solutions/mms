import { CLIENT_SOFT_DELETE_KEYS, stripClientSoftDeleteFields } from "./contactSoftDelete.js";
import { filterActiveEnrollments, isEnrollmentDeleted } from "./enrollmentsModuleManifest.js";

/** Client-supplied soft-delete keys for enrollment mutations. */
export const ENROLLMENT_CLIENT_SOFT_DELETE_KEYS = CLIENT_SOFT_DELETE_KEYS;

/** Strip client soft-delete metadata from enrollment create/update payloads. */
export function stripEnrollmentClientSoftDeleteFields<T>(record: T): T {
  return stripClientSoftDeleteFields(record);
}

export { stripClientSoftDeleteFields } from "./contactSoftDelete.js";

export { isEntityDeleted, filterActiveEntities } from "./softDelete.js";

export { filterActiveEnrollments, isEnrollmentDeleted };

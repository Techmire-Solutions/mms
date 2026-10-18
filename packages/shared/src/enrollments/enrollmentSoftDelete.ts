import {
  CLIENT_SOFT_DELETE_KEYS,
  stripClientSoftDeleteFields,
} from "../contacts/contactSoftDelete.js";
import { filterActiveEnrollments, isEnrollmentDeleted } from "./enrollmentsModuleManifest.js";

/** Client-supplied soft-delete keys for enrollment mutations. */
export const ENROLLMENT_CLIENT_SOFT_DELETE_KEYS = CLIENT_SOFT_DELETE_KEYS;

/** Strip client soft-delete metadata from enrollment create/update payloads. */
export function stripEnrollmentClientSoftDeleteFields<T>(record: T): T {
  return stripClientSoftDeleteFields(record);
}

export { stripClientSoftDeleteFields } from "../contacts/contactSoftDelete.js";

export { isEntityDeleted, filterActiveEntities } from "../core/softDelete.js";

export { filterActiveEnrollments, isEnrollmentDeleted };

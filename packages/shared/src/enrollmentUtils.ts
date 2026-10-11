export {
  ENROLLMENT_CLIENT_SOFT_DELETE_KEYS,
  stripEnrollmentClientSoftDeleteFields,
  stripClientSoftDeleteFields,
  isEntityDeleted,
  filterActiveEntities,
  isEnrollmentDeleted,
  filterActiveEnrollments,
} from "./enrollmentSoftDelete.js";

import { stripEnrollmentClientSoftDeleteFields } from "./enrollmentSoftDelete.js";

/** Normalize an enrollment row before persist (strips client soft-delete keys). */
export function normalizeStoredEnrollment<T extends Record<string, unknown>>(record: T): T {
  return stripEnrollmentClientSoftDeleteFields(record);
}

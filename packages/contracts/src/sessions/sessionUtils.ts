export {
  SESSION_CLIENT_SOFT_DELETE_KEYS,
  stripSessionClientSoftDeleteFields,
  stripClientSoftDeleteFields,
  isEntityDeleted,
  filterActiveEntities,
  isSessionDeleted,
  filterActiveSessions,
} from "./sessionSoftDelete.js";

import { stripSessionClientSoftDeleteFields } from "./sessionSoftDelete.js";

/** Normalize a session row before persist (strips client soft-delete keys). */
export function normalizeStoredSession<T extends Record<string, unknown>>(record: T): T {
  return stripSessionClientSoftDeleteFields(record);
}

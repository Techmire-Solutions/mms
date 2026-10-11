import { CLIENT_SOFT_DELETE_KEYS, stripClientSoftDeleteFields } from "./contactSoftDelete.js";
import { filterActiveSessions, isSessionDeleted } from "./sessionTypes.js";

/** Client-supplied soft-delete keys for session mutations. */
export const SESSION_CLIENT_SOFT_DELETE_KEYS = CLIENT_SOFT_DELETE_KEYS;

/** Strip client soft-delete metadata from session create/update payloads. */
export function stripSessionClientSoftDeleteFields<T>(record: T): T {
  return stripClientSoftDeleteFields(record);
}

export { stripClientSoftDeleteFields } from "./contactSoftDelete.js";

export { isEntityDeleted, filterActiveEntities } from "./softDelete.js";

export { filterActiveSessions, isSessionDeleted };

import {
  isServerOnlyObjectKey,
  WORKSPACES_COLLECTION,
  PLATFORM_SUPER_USERS_OBJECT_KEY,
  type TenantDatabaseSnapshot,
} from "@mms/shared";
import type { User } from "@mms/shared";
import { canWriteCollection, canWriteObject } from "../../../services/rbacService.js";

export function stripServerOnlyObjects(objects: Record<string, unknown>): void {
  for (const key of Object.keys(objects)) {
    if (isServerOnlyObjectKey(key)) delete objects[key];
  }
}

/** Drops collections the admin cannot write. */
export function stripUnwritableCollections(
  collections: Record<string, unknown[]>,
  user: User,
): void {
  for (const key of Object.keys(collections)) {
    if (!canWriteCollection(user, key)) {
      delete collections[key];
    }
  }
}

/** Same for settings objects that are no longer writable. */
export function stripUnwritableObjects(objects: Record<string, unknown>, user: User): void {
  for (const key of Object.keys(objects)) {
    if (!canWriteObject(user, key)) {
      delete objects[key];
    }
  }
}

export function sanitizeSnapshot(
  snapshot: TenantDatabaseSnapshot,
  _user: User,
): TenantDatabaseSnapshot {
  if (snapshot.collections) {
    delete snapshot.collections[WORKSPACES_COLLECTION];
  }
  if (snapshot.objects) {
    delete snapshot.objects[PLATFORM_SUPER_USERS_OBJECT_KEY];
    stripServerOnlyObjects(snapshot.objects);
  }
  return snapshot;
}

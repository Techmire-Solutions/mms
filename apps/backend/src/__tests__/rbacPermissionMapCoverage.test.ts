import { describe, expect, it } from "vitest";
import {
  ALLOWED_COLLECTIONS,
  ALLOWED_OBJECTS,
  COLLECTION_READ_PERMISSION,
  COLLECTION_WRITE_PERMISSION,
  OBJECT_READ_PERMISSION,
  OBJECT_WRITE_PERMISSION,
  STAFF_WRITE_COLLECTION_KEYS,
  isStaffWriteObjectKey,
} from "../lib/rbacPermissionMaps.js";

/** Allowed for read but deliberately never writable (blocked early in computeCanWriteObject). */
const INTENTIONALLY_WRITE_DISABLED_OBJECTS = new Set(["platform_settings"]);

/**
 * The object/collection permission resolvers now fail closed: an allowed key that is
 * neither explicitly mapped nor listed in the staff write sets is denied. These tests
 * guarantee that invariant for the *current* allow-lists, so adding a new allowed key
 * without a mapping fails here instead of silently widening access to staff roles.
 */
describe("rbac permission map coverage", () => {
  it("resolves every allowed object key to a permission or an explicit staff entry", () => {
    const unresolvedRead = [...ALLOWED_OBJECTS].filter(
      (key) => !OBJECT_READ_PERMISSION[key] && !isStaffWriteObjectKey(key),
    );
    const unresolvedWrite = [...ALLOWED_OBJECTS].filter(
      (key) =>
        !OBJECT_WRITE_PERMISSION[key] &&
        !isStaffWriteObjectKey(key) &&
        !INTENTIONALLY_WRITE_DISABLED_OBJECTS.has(key),
    );

    expect(unresolvedRead).toEqual([]);
    expect(unresolvedWrite).toEqual([]);
  });

  it("resolves every allowed collection to a permission or an explicit staff entry", () => {
    const unresolvedRead = [...ALLOWED_COLLECTIONS].filter(
      (name) => !COLLECTION_READ_PERMISSION[name] && !STAFF_WRITE_COLLECTION_KEYS.has(name),
    );
    const unresolvedWrite = [...ALLOWED_COLLECTIONS].filter(
      (name) => !COLLECTION_WRITE_PERMISSION[name] && !STAFF_WRITE_COLLECTION_KEYS.has(name),
    );

    expect(unresolvedRead).toEqual([]);
    expect(unresolvedWrite).toEqual([]);
  });
});

import type { AppTranslationKey } from "./appTranslations.js";
import { isBackupExcludedObjectKey, isServerOnlyObjectKey } from "./emailIntegrationTypes.js";
import type { TenantDatabaseSnapshot } from "./backupSchemas.js";

/** Detects prototype pollution keys recursively in any parsed value. */
export function hasPrototypePollution(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (hasPrototypePollution(item)) return true;
    }
    return false;
  }
  const recordValue = value as Record<string, unknown>;
  for (const key of Object.keys(recordValue)) {
    if (key === "__proto__") {
      return true;
    }
    if (
      key === "constructor" &&
      recordValue.constructor &&
      typeof recordValue.constructor === "object" &&
      "prototype" in (recordValue.constructor as Record<string, unknown>)
    ) {
      return true;
    }
    if (hasPrototypePollution(recordValue[key])) {
      return true;
    }
  }
  return false;
}

/** Checks if a logical key represents a restricted platform-level resource. */
function isRestrictedKey(logicalKey: string): boolean {
  const lower = logicalKey.toLowerCase();
  return (
    lower === "workspaces" ||
    lower === "platform_super_users" ||
    lower === "platform_users" ||
    lower === "auth_artifacts" ||
    lower === "__proto__" ||
    lower.startsWith("platform_")
  );
}

/** Validate if a database snapshot contains any restricted platform-level key. Returns first restricted key found, or null. */
export function findRestrictedKeyInSnapshot(snapshot: TenantDatabaseSnapshot): string | null {
  if (snapshot.collections) {
    for (const key of Object.keys(snapshot.collections)) {
      if (isRestrictedKey(key)) return key;
    }
  }
  if (snapshot.objects) {
    for (const key of Object.keys(snapshot.objects)) {
      if (isRestrictedKey(key)) return key;
    }
  }
  return null;
}

/**
 * Validates, deduplicates, and sanitizes a tenant database snapshot.
 * Enforces prototype pollution prevention, restricted key detection, and admin user verification.
 */
export function validateAndNormalizeSnapshot(
  snapshot: TenantDatabaseSnapshot,
): { ok: true; data: TenantDatabaseSnapshot } | { ok: false; errorKey: AppTranslationKey } {
  if (hasPrototypePollution(snapshot)) {
    return { ok: false, errorKey: "backup.securityViolation" };
  }

  // Strip backup-excluded keys (e.g. platform_settings) before the restricted-key
  // guard: they carry a `platform_*` prefix the guard would reject, but they are
  // platform-authoritative tenant data that must be dropped, not rejected, so older
  // backups still restore. Server-only (secret/ephemeral) keys are dropped here too.
  const objects: Record<string, unknown> = {};
  if (snapshot.objects) {
    for (const [key, value] of Object.entries(snapshot.objects)) {
      if (isBackupExcludedObjectKey(key)) continue;
      if (isServerOnlyObjectKey(key)) continue;
      objects[key] = value;
    }
  }

  const restrictedKey = findRestrictedKeyInSnapshot({
    collections: snapshot.collections,
    objects,
  });
  if (restrictedKey) {
    return { ok: false, errorKey: "backup.securityViolation" };
  }

  const collections = snapshot.collections ? { ...snapshot.collections } : {};

  for (const [colName, rows] of Object.entries(collections)) {
    if (Array.isArray(rows)) {
      const seen = new Set<string>();
      const deduped: unknown[] = [];
      for (const item of rows) {
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          if ("id" in record && record.id !== undefined && record.id !== null) {
            const idStr = String(record.id);
            if (seen.has(idStr)) {
              continue;
            }
            seen.add(idStr);
          }
        }
        deduped.push(item);
      }
      collections[colName] = deduped;
    }
  }

  if (collections.users) {
    const hasActiveAdmin = collections.users.some((u: unknown) => {
      if (!u || typeof u !== "object") return false;
      const record = u as Record<string, unknown>;
      const isAdmin =
        ("role" in record && record.role === "admin") ||
        ("roles" in record &&
          Array.isArray(record.roles) &&
          (record.roles as string[]).includes("admin"));
      if (!isAdmin) return false;
      // A soft-deleted admin cannot log in to recover the workspace. Only enforce
      // when the field is present so legacy backups without `deletedAt` still restore.
      if ("deletedAt" in record && record.deletedAt != null) return false;
      return true;
    });
    if (!hasActiveAdmin) {
      return { ok: false, errorKey: "backup.missingAdminUser" };
    }
  }

  const assets: Record<string, string> = {};
  if (snapshot.assets && typeof snapshot.assets === "object" && !Array.isArray(snapshot.assets)) {
    for (const [pathKey, data] of Object.entries(snapshot.assets)) {
      if (
        typeof pathKey === "string" &&
        typeof data === "string" &&
        pathKey.startsWith("/uploads/") &&
        !pathKey.includes("..") &&
        !pathKey.includes("\\")
      ) {
        assets[pathKey] = data;
      }
    }
  }

  return {
    ok: true,
    data: {
      collections,
      objects,
      ...(Object.keys(assets).length > 0 ? { assets } : {}),
    },
  };
}

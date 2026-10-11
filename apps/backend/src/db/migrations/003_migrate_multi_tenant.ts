import { randomBytes } from "node:crypto";
import {
  WORKSPACES_COLLECTION,
  tenantCollectionKey,
  tenantObjectKey,
  type Workspace,
} from "@mms/shared";
import {
  deleteCollectionByStorageName,
  deleteObjectByStorageKey,
  getCollectionByStorageName,
  getObject,
  getObjectByStorageKey,
  listCollectionStorageNames,
  listObjectStorageKeys,
  runInTransaction,
  saveCollection,
  saveObject,
} from "../database.js";

interface LegacyWorkspace {
  subdomain: string;
  madrasaName: string;
  tagline?: string;
  country?: string;
  createdAt: string;
}

interface LegacyStoredUser {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
  createdAt: string;
  workspaceSubdomain?: string;
}

/**
 * Migrates single-tenant document storage to per-subdomain prefixed keys.
 */
export async function runMigration003(): Promise<void> {
  let names: string[];
  try {
    names = await listCollectionStorageNames();
  } catch (err: unknown) {
    // Fresh schema: objects table doesn't exist yet — nothing to migrate.
    const code =
      (err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
    if (code === "42P01") return;
    throw err;
  }
  if (names.some((name) => name.startsWith("t:"))) {
    return;
  }

  const legacyWorkspace = (await getObject("workspace")) as LegacyWorkspace | null;
  if (!legacyWorkspace?.subdomain) {
    return;
  }

  const subdomain = legacyWorkspace.subdomain;
  const workspaceId = randomBytes(8).toString("hex");

  await runInTransaction(async () => {
    for (const name of names) {
      if (name === WORKSPACES_COLLECTION) continue;
      const collectionRows = await getCollectionByStorageName(name);
      if (!Array.isArray(collectionRows)) continue;
      await saveCollection(tenantCollectionKey(subdomain, name), collectionRows);
      await deleteCollectionByStorageName(name);
    }

    const objectKeys = await listObjectStorageKeys();
    for (const key of objectKeys) {
      if (key === "workspace") {
        await deleteObjectByStorageKey(key);
        continue;
      }
      const objectValue = await getObjectByStorageKey(key);
      if (objectValue === null) continue;
      await saveObject(tenantObjectKey(subdomain, key), objectValue);
      await deleteObjectByStorageKey(key);
    }

    const usersKey = tenantCollectionKey(subdomain, "users");
    const users = (await getCollectionByStorageName(usersKey)) as LegacyStoredUser[] | null;
    if (Array.isArray(users)) {
      const normalized = users.map((user) => ({
        ...user,
        workspaceSubdomain: user.workspaceSubdomain ?? subdomain,
      }));
      await saveCollection(usersKey, normalized);
    }

    const workspace: Workspace = {
      id: workspaceId,
      subdomain: legacyWorkspace.subdomain,
      madrasaName: legacyWorkspace.madrasaName,
      tagline: legacyWorkspace.tagline,
      country: legacyWorkspace.country,
      createdAt: legacyWorkspace.createdAt ?? new Date().toISOString(),
    };
    await saveCollection(WORKSPACES_COLLECTION, [workspace]);
  });

  console.log(`Migration 003: scoped existing data to tenant "${subdomain}".`);
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_EXPORT_ARTIFACTS_OBJECT_KEY } from "@mms/shared";

const { store, deleteStorageObject, mutex } = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  deleteStorageObject: vi.fn().mockResolvedValue(undefined),
  mutex: { tail: Promise.resolve() as Promise<unknown> },
}));

vi.mock("../db/documentStoreObjects.js", () => ({
  getObject: async (key: string) => store.get(key) ?? null,
  saveObject: async (key: string, value: unknown) => {
    store.set(key, value);
  },
}));
vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, callback: () => Promise<unknown>) => {
    // Serialize transactions the way a row lock does in Postgres.
    const run = mutex.tail.then(() => callback());
    mutex.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  },
}));
vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "tenant-1",
}));
vi.mock("../config/storage.js", () => ({
  deleteStorageObject: (...args: unknown[]) => deleteStorageObject(...args),
}));

import {
  deleteExportArtifacts,
  saveStreamedExportArtifact,
} from "../services/exportArtifactService.js";

type StoredMap = Record<string, Record<string, { key?: string }>>;

function storedMap(): StoredMap {
  return (store.get(USER_EXPORT_ARTIFACTS_OBJECT_KEY) as StoredMap | undefined) ?? {};
}

describe("export artifact registry concurrency", () => {
  beforeEach(() => {
    store.clear();
    deleteStorageObject.mockClear();
    mutex.tail = Promise.resolve();
  });

  it("keeps both entries when two jobs finish concurrently", async () => {
    await Promise.all([
      saveStreamedExportArtifact("user-1", "job-a", {
        key: "tenants/tenant-1/exports/a.csv",
        storageType: "local",
        filename: "a.csv",
      }),
      saveStreamedExportArtifact("user-1", "job-b", {
        key: "tenants/tenant-1/exports/b.csv",
        storageType: "local",
        filename: "b.csv",
      }),
    ]);

    expect(Object.keys(storedMap()["user-1"] ?? {}).sort()).toEqual(["job-a", "job-b"]);
  });

  it("deletes the blob replaced by a retry", async () => {
    await saveStreamedExportArtifact("user-1", "job-a", {
      key: "tenants/tenant-1/exports/old.csv",
      storageType: "local",
      filename: "a.csv",
    });
    await saveStreamedExportArtifact("user-1", "job-a", {
      key: "tenants/tenant-1/exports/new.csv",
      storageType: "local",
      filename: "a.csv",
    });

    expect(deleteStorageObject).toHaveBeenCalledWith("tenants/tenant-1/exports/old.csv", "local");
    expect(storedMap()["user-1"]?.["job-a"]?.key).toBe("tenants/tenant-1/exports/new.csv");
  });

  it("removes artifacts and blobs for removed job ids in one pass", async () => {
    await saveStreamedExportArtifact("user-1", "job-a", {
      key: "tenants/tenant-1/exports/a.csv",
      storageType: "local",
      filename: "a.csv",
    });
    await saveStreamedExportArtifact("user-1", "job-b", {
      key: "tenants/tenant-1/exports/b.csv",
      storageType: "local",
      filename: "b.csv",
    });

    const removed = await deleteExportArtifacts("user-1", ["job-a", "job-b"]);

    expect(removed).toBe(2);
    expect(storedMap()["user-1"]).toBeUndefined();
    expect(deleteStorageObject).toHaveBeenCalledTimes(2);
  });
});

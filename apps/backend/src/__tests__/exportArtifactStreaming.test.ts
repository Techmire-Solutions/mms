import { describe, it, expect, vi, beforeEach } from "vitest";
import { PassThrough } from "node:stream";
import { existsSync } from "node:fs";
import {
  uploadStreamToStorage,
  readStreamFromStorage,
  resolveLocalArtifactPath,
} from "../config/storage.js";
import {
  saveStreamedExportArtifact,
  getExportArtifact,
  deleteExportArtifact,
} from "../services/exportArtifactService.js";
import { USER_EXPORT_ARTIFACTS_OBJECT_KEY } from "@mms/shared";

// In-memory doc-store object map (mirrors dbSyncService.fetchObject/persistObject).
const mockStore = new Map<string, unknown>();
vi.mock("../services/dbSyncService.js", () => ({
  fetchObject: async (key: string) => mockStore.get(key) ?? null,
  persistObject: async (key: string, value: unknown) => {
    mockStore.set(key, value);
  },
}));

async function collectStream(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("streamed export artifacts", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it("uploadStreamToStorage writes CSV to local storage and can be read back as a stream", async () => {
    const passThrough = new PassThrough();
    const uploadPromise = uploadStreamToStorage(
      "tenant-1",
      "keys/artifact-1.csv",
      passThrough,
      "text/csv",
    );
    passThrough.write("id,name\n1,Ali\n2,Sara");
    passThrough.end();
    const { key, storageType } = await uploadPromise;

    expect(key).toContain("artifact-1.csv");
    expect(storageType).toBe("local");

    const stream = await readStreamFromStorage(key, storageType);
    expect(await collectStream(stream)).toBe("id,name\n1,Ali\n2,Sara");
  });

  it("saveStreamedExportArtifact persists only the key (no content) and get/delete lifecycle works", async () => {
    const passThrough = new PassThrough();
    const uploadPromise = uploadStreamToStorage(
      "tenant-1",
      "keys/artifact-2.csv",
      passThrough,
      "text/csv",
    );
    passThrough.write("a,b\n1,2");
    passThrough.end();
    const { key, storageType } = await uploadPromise;

    await saveStreamedExportArtifact("user-1", "job-1", {
      key,
      storageType,
      filename: "contacts.csv",
      contentType: "text/csv; charset=utf-8",
    });

    const artifactMap = mockStore.get(USER_EXPORT_ARTIFACTS_OBJECT_KEY) as {
      "user-1": Record<string, unknown>;
    };
    expect(artifactMap?.["user-1"]?.["job-1"]).toBeDefined();
    const stored = artifactMap["user-1"]["job-1"] as Record<string, unknown>;
    // Content is NOT buffered — only the storage reference is kept.
    expect("content" in stored).toBe(false);
    expect(stored.key).toBe(key);

    const artifact = await getExportArtifact("user-1", "job-1");
    expect(artifact?.key).toBe(key);
    expect(artifact?.storageType).toBe("local");
    expect(artifact?.contentType).toContain("text/csv");

    const stream = await readStreamFromStorage(artifact!.key!, artifact!.storageType!);
    expect(await collectStream(stream)).toBe("a,b\n1,2");

    // Deleting the artifact also removes the streamed blob from local storage.
    const blobPath = resolveLocalArtifactPath(key);
    expect(existsSync(blobPath)).toBe(true);
    await deleteExportArtifact("user-1", "job-1");
    expect(existsSync(blobPath)).toBe(false);

    expect(await getExportArtifact("user-1", "job-1")).toBeNull();
  });
});

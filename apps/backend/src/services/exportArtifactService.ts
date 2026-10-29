import { USER_EXPORT_ARTIFACTS_OBJECT_KEY } from "@mms/shared";
import { getObject, saveObject } from "../db/documentStoreObjects.js";
import { withTenant } from "../db/tenant-context.js";
import { getRequestTenant } from "../lib/tenantContext.js";
import { deleteStorageObject } from "../config/storage.js";

const STORAGE_KEY = USER_EXPORT_ARTIFACTS_OBJECT_KEY;
const ARTIFACT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_USER_ARTIFACTS = 10;
/** Per-artifact content cap so a single cross-user document cannot grow unbounded. */
const MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;

interface ExportArtifact {
  filename: string;
  expiresAt: string;
  /** Legacy inline content (buffered doc-store artifact). */
  content?: string;
  /** Streaming artifact stored in blob storage (S3 or local). */
  storageType?: "s3" | "local";
  key?: string;
  contentType?: string;
}

export interface ExportArtifactResult {
  filename: string;
  content?: string;
  storageType?: "s3" | "local";
  key?: string;
  contentType?: string;
}

type UserArtifactMap = Record<string, Record<string, ExportArtifact>>;
type BlobRef = { key: string; storageType: "s3" | "local" };
type ArtifactMutation<T> = { result: T; blobs?: BlobRef[] };

function parseArtifactMap(raw: unknown): UserArtifactMap {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as UserArtifactMap;
  }
  return {};
}

function artifactBlob(artifact: ExportArtifact | undefined): BlobRef | null {
  if (!artifact?.key || !artifact.storageType) return null;
  return { key: artifact.key, storageType: artifact.storageType };
}

/**
 * Drops expired artifacts and enforces the per-user artifact cap without
 * performing I/O, so it can run while the registry row is locked.
 */
function pruneExpired(allArtifacts: UserArtifactMap): {
  cleaned: UserArtifactMap;
  droppedBlobs: BlobRef[];
} {
  const now = Date.now();
  const cleaned: UserArtifactMap = {};
  const droppedBlobs: BlobRef[] = [];
  for (const [user, artifacts] of Object.entries(allArtifacts)) {
    const entries = Object.entries(artifacts);
    const activeEntries = entries
      .filter(([, artifact]) => new Date(artifact.expiresAt).getTime() > now)
      .sort((a, b) => new Date(b[1].expiresAt).getTime() - new Date(a[1].expiresAt).getTime())
      .slice(0, MAX_USER_ARTIFACTS);
    const activeKeys = new Set(activeEntries.map(([key]) => key));
    for (const [key, artifact] of entries) {
      if (!activeKeys.has(key)) {
        const blob = artifactBlob(artifact);
        if (blob) droppedBlobs.push(blob);
      }
    }
    if (activeEntries.length > 0) {
      cleaned[user] = Object.fromEntries(activeEntries);
    }
  }
  return { cleaned, droppedBlobs };
}

async function deleteBlobsBestEffort(blobs: BlobRef[]): Promise<void> {
  if (blobs.length === 0) return;
  await Promise.allSettled(blobs.map((blob) => deleteStorageObject(blob.key, blob.storageType)));
}

/**
 * Serializes a load/prune/mutate/save cycle behind a row lock so concurrent
 * workers cannot lose each other's artifact entries.
 */
async function mutateArtifactMap<T>(
  mutate: (artifacts: UserArtifactMap) => ArtifactMutation<T>,
): Promise<T> {
  const tenant = getRequestTenant();
  if (!tenant) {
    throw new Error("Tenant context is required to persist export artifacts");
  }

  const committed = await withTenant(tenant, async () => {
    const raw = await getObject(STORAGE_KEY, { forUpdate: true });
    const { cleaned, droppedBlobs } = pruneExpired(parseArtifactMap(raw));
    const mutation = mutate(cleaned);
    await saveObject(STORAGE_KEY, cleaned);
    return { result: mutation.result, blobs: [...droppedBlobs, ...(mutation.blobs ?? [])] };
  });

  // Blob deletion happens after commit so slow storage I/O never holds the row lock.
  await deleteBlobsBestEffort(committed.blobs);
  return committed.result;
}

export async function saveExportArtifact(
  userId: string,
  jobId: string,
  content: string,
  filename: string,
): Promise<void> {
  if (Buffer.byteLength(content, "utf8") > MAX_ARTIFACT_BYTES) {
    throw new Error(
      `Export artifact exceeds maximum of ${MAX_ARTIFACT_BYTES} bytes and cannot be stored.`,
    );
  }
  await mutateArtifactMap((artifactsByUser) => {
    const userArtifacts = artifactsByUser[userId] ?? {};
    const replaced = artifactBlob(userArtifacts[jobId]);
    userArtifacts[jobId] = {
      content,
      filename,
      expiresAt: new Date(Date.now() + ARTIFACT_TTL_MS).toISOString(),
    };
    artifactsByUser[userId] = userArtifacts;
    return { result: undefined, blobs: replaced ? [replaced] : [] };
  });
}

export async function getExportArtifact(
  userId: string,
  jobId: string,
): Promise<ExportArtifactResult | null> {
  const raw = await getObject(STORAGE_KEY);
  const { cleaned, droppedBlobs } = pruneExpired(parseArtifactMap(raw));
  await deleteBlobsBestEffort(droppedBlobs);
  const artifact = cleaned[userId]?.[jobId];
  if (!artifact) return null;
  return {
    filename: artifact.filename,
    content: artifact.content,
    storageType: artifact.storageType,
    key: artifact.key,
    contentType: artifact.contentType,
  };
}

/**
 * Stores a streamed export artifact by its blob-storage key (S3 or local) instead
 * of buffering the full content in the doc store. Callers stream the artifact to
 * storage (e.g. via `uploadStreamToStorage`) and persist only the reference here.
 */
export async function saveStreamedExportArtifact(
  userId: string,
  jobId: string,
  info: {
    key: string;
    storageType: "s3" | "local";
    filename: string;
    contentType?: string;
  },
): Promise<void> {
  await mutateArtifactMap((artifactsByUser) => {
    const userArtifacts = artifactsByUser[userId] ?? {};
    const replaced = artifactBlob(userArtifacts[jobId]);
    userArtifacts[jobId] = {
      filename: info.filename,
      expiresAt: new Date(Date.now() + ARTIFACT_TTL_MS).toISOString(),
      key: info.key,
      storageType: info.storageType,
      ...(info.contentType ? { contentType: info.contentType } : {}),
    };
    artifactsByUser[userId] = userArtifacts;
    return {
      result: undefined,
      blobs: replaced && replaced.key !== info.key ? [replaced] : [],
    };
  });
}

export async function deleteExportArtifact(userId: string, jobId: string): Promise<void> {
  await mutateArtifactMap((artifactsByUser) => {
    const userArtifacts = artifactsByUser[userId];
    const artifact = userArtifacts?.[jobId];
    if (!userArtifacts || !artifact) return { result: undefined };
    const blob = artifactBlob(artifact);
    delete userArtifacts[jobId];
    if (Object.keys(userArtifacts).length === 0) delete artifactsByUser[userId];
    return { result: undefined, blobs: blob ? [blob] : [] };
  });
}

/** Deletes artifacts for many removed jobs in one locked registry update. */
export async function deleteExportArtifacts(userId: string, jobIds: string[]): Promise<number> {
  const uniqueIds = [...new Set(jobIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return 0;
  return mutateArtifactMap((artifactsByUser) => {
    const userArtifacts = artifactsByUser[userId];
    if (!userArtifacts) return { result: 0 };
    const blobs: BlobRef[] = [];
    let removed = 0;
    for (const jobId of uniqueIds) {
      const artifact = userArtifacts[jobId];
      if (!artifact) continue;
      const blob = artifactBlob(artifact);
      if (blob) blobs.push(blob);
      delete userArtifacts[jobId];
      removed++;
    }
    if (removed > 0 && Object.keys(userArtifacts).length === 0) delete artifactsByUser[userId];
    return { result: removed, blobs };
  });
}

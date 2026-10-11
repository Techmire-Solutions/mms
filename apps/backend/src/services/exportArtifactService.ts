import { USER_EXPORT_ARTIFACTS_OBJECT_KEY } from "@mms/shared";
import { fetchObject, persistObject } from "./dbSyncService.js";
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

async function loadUserArtifactMap(): Promise<UserArtifactMap> {
  const raw = await fetchObject(STORAGE_KEY);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as UserArtifactMap;
  }
  return {};
}

async function saveUserArtifactMap(artifactsByUser: UserArtifactMap): Promise<void> {
  await persistObject(STORAGE_KEY, artifactsByUser);
}

async function pruneAllExpired(allArtifacts: UserArtifactMap): Promise<UserArtifactMap> {
  const now = Date.now();
  const cleaned: UserArtifactMap = {};
  const droppedBlobs: Array<{ key: string; storageType: "s3" | "local" }> = [];
  for (const [user, artifacts] of Object.entries(allArtifacts)) {
    const entries = Object.entries(artifacts);
    const activeEntries = entries
      .filter(([_, artifact]) => new Date(artifact.expiresAt).getTime() > now)
      .sort((a, b) => new Date(b[1].expiresAt).getTime() - new Date(a[1].expiresAt).getTime())
      .slice(0, MAX_USER_ARTIFACTS);
    const activeKeys = new Set(activeEntries.map(([key]) => key));
    for (const [key, artifact] of entries) {
      if (!activeKeys.has(key) && artifact.key && artifact.storageType) {
        droppedBlobs.push({ key: artifact.key, storageType: artifact.storageType });
      }
    }
    if (activeEntries.length > 0) {
      cleaned[user] = Object.fromEntries(activeEntries);
    }
  }
  // Best-effort: remove blobs for expired/evicted streamed artifacts so storage
  // does not accumulate orphaned files.
  await Promise.allSettled(
    droppedBlobs.map((blob) => deleteStorageObject(blob.key, blob.storageType)),
  );
  return cleaned;
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
  const artifactsByUser = await pruneAllExpired(await loadUserArtifactMap());
  const userArtifacts = artifactsByUser[userId] ?? {};
  userArtifacts[jobId] = {
    content,
    filename,
    expiresAt: new Date(Date.now() + ARTIFACT_TTL_MS).toISOString(),
  };
  artifactsByUser[userId] = userArtifacts;
  await saveUserArtifactMap(artifactsByUser);
}

export async function getExportArtifact(
  userId: string,
  jobId: string,
): Promise<ExportArtifactResult | null> {
  const artifactsByUser = await pruneAllExpired(await loadUserArtifactMap());
  const userArtifacts = artifactsByUser[userId] ?? {};
  const artifact = userArtifacts[jobId];
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
  const artifactsByUser = await pruneAllExpired(await loadUserArtifactMap());
  const userArtifacts = artifactsByUser[userId] ?? {};
  userArtifacts[jobId] = {
    filename: info.filename,
    expiresAt: new Date(Date.now() + ARTIFACT_TTL_MS).toISOString(),
    key: info.key,
    storageType: info.storageType,
    ...(info.contentType ? { contentType: info.contentType } : {}),
  };
  artifactsByUser[userId] = userArtifacts;
  await saveUserArtifactMap(artifactsByUser);
}

export async function deleteExportArtifact(userId: string, jobId: string): Promise<void> {
  const artifactsByUser = await loadUserArtifactMap();
  const userArtifacts = artifactsByUser[userId];
  const artifact = userArtifacts?.[jobId];
  if (!artifact) return;
  // Best-effort: remove the streamed blob when a keyed artifact is dismissed.
  if (artifact.key && artifact.storageType) {
    await deleteStorageObject(artifact.key, artifact.storageType).catch(() => undefined);
  }
  delete userArtifacts[jobId];
  artifactsByUser[userId] = userArtifacts;
  await saveUserArtifactMap(artifactsByUser);
}

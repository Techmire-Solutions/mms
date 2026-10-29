import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { type Readable, type PassThrough } from "node:stream";
import { mkdir, writeFile, unlink, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { resolveUploadsRoot } from "./uploadConfig.js";

export interface StorageUploadResult {
  key: string;
  storageType: "s3" | "local";
  url: string;
}

const s3Bucket = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || "";
const s3Region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

export const isS3Configured = Boolean(
  s3Bucket &&
  (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_ROLE_ARN),
);

export const s3Client = new S3Client({
  region: s3Region,
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

export function resolveTenantExportKey(tenantId: string, filename: string): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `tenants/${tenantId}/exports/${Date.now()}-${sanitized}`;
}

export function resolveLocalArtifactPath(s3Key: string): string {
  return join(resolveUploadsRoot(), s3Key);
}

function storageAbortError(): Error {
  const error = new Error("Storage upload aborted");
  error.name = "AbortError";
  return error;
}

export async function uploadStreamToStorage(
  _tenantId: string,
  key: string,
  stream: Readable | PassThrough,
  contentType = "application/octet-stream",
  options: { signal?: AbortSignal } = {},
): Promise<StorageUploadResult> {
  if (options.signal?.aborted) throw storageAbortError();

  if (isS3Configured) {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: s3Bucket,
        Key: key,
        Body: stream,
        ContentType: contentType,
      },
    });
    const abortUpload = () => {
      void upload.abort().catch(() => undefined);
    };
    options.signal?.addEventListener("abort", abortUpload, { once: true });

    try {
      await upload.done();
    } catch (error) {
      if (options.signal?.aborted) throw storageAbortError();
      throw error;
    } finally {
      options.signal?.removeEventListener("abort", abortUpload);
    }
    if (options.signal?.aborted) throw storageAbortError();
    return {
      key,
      storageType: "s3",
      url: `/api/downloads/${key}`,
    };
  }

  // Local storage fallback
  const localPath = resolveLocalArtifactPath(key);
  await mkdir(dirname(localPath), { recursive: true });
  const writeStream = createWriteStream(localPath);
  const abortLocal = () => {
    writeStream.destroy(storageAbortError());
    stream.destroy(storageAbortError());
  };
  options.signal?.addEventListener("abort", abortLocal, { once: true });
  try {
    await pipeline(stream, writeStream);
  } catch (error) {
    if (options.signal?.aborted) throw storageAbortError();
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", abortLocal);
  }

  return {
    key,
    storageType: "local",
    url: `/uploads/${key}`,
  };
}

export async function uploadBufferToStorage(
  _tenantId: string,
  key: string,
  buffer: Buffer,
  contentType = "application/octet-stream",
): Promise<StorageUploadResult> {
  if (isS3Configured) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return {
      key,
      storageType: "s3",
      url: `/api/downloads/${key}`,
    };
  }

  const localPath = resolveLocalArtifactPath(key);
  await mkdir(dirname(localPath), { recursive: true });
  await writeFile(localPath, buffer);

  return {
    key,
    storageType: "local",
    url: `/uploads/${key}`,
  };
}

/**
 * Opens a readable stream for a previously streamed storage object (S3 body or
 * local file). Used to serve export artifacts as true streams instead of
 * re-buffering the whole blob in memory.
 */
export async function readStreamFromStorage(
  key: string,
  storageType: "s3" | "local",
): Promise<Readable> {
  if (storageType === "s3" && isS3Configured) {
    const data = await s3Client.send(new GetObjectCommand({ Bucket: s3Bucket, Key: key }));
    const body = data.Body as Readable | undefined;
    if (!body) {
      throw new Error(`S3 object has no readable body: ${key}`);
    }
    return body;
  }
  return createReadStream(resolveLocalArtifactPath(key));
}

/** Deletes every object under a storage prefix (S3 or local directory). */
export async function deleteStoragePrefix(prefix: string): Promise<void> {
  if (isS3Configured) {
    let continuationToken: string | undefined;
    do {
      const listed = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: s3Bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      const objects = (listed.Contents ?? [])
        .map((object) => object.Key)
        .filter((key): key is string => Boolean(key))
        .map((Key) => ({ Key }));
      if (objects.length > 0) {
        await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: s3Bucket,
            Delete: { Objects: objects, Quiet: true },
          }),
        );
      }
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
    return;
  }
  await rm(resolveLocalArtifactPath(prefix), { recursive: true, force: true });
}

/**
 * Deletes a streamed storage object (S3 object or local file). Local deletes are
 * idempotent (missing files are ignored); S3 deletes are best-effort.
 */
export async function deleteStorageObject(key: string, storageType: "s3" | "local"): Promise<void> {
  if (storageType === "s3" && isS3Configured) {
    await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }));
    return;
  }
  const localPath = resolveLocalArtifactPath(key);
  try {
    await unlink(localPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

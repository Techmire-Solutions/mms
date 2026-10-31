import crypto, { createCipheriv, createDecipheriv } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { activeDb } from "../db/dbConnection.js";
import { cryptoShreddingKeys } from "../db/schema/auditTrail.js";
import { decryptSecretAtRest, encryptSecretAtRest } from "./cryptoAtRest.js";
import { logger } from "./logger.js";

const ALGORITHM = "aes-256-gcm";
const SUBJECT_ENC_PREFIX = "enc:subject:";
const IV_LENGTH = 12;

export class SubjectKeyShreddedError extends Error {
  constructor(public readonly subjectId: string) {
    super(`Subject encryption key for "${subjectId}" has been permanently shredded.`);
    this.name = "SubjectKeyShreddedError";
  }
}

/**
 * Retrieves an existing subject key without ever creating one. Decryption paths
 * must use this: a read must not insert a fresh key for ciphertext it cannot
 * open (that would both mutate on GET and destroy the shredding guarantee).
 */
export async function getExistingSubjectKey(
  workspaceSubdomain: string,
  subjectId: string,
): Promise<Buffer | null> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  const normalizedSubject = subjectId.trim();
  if (!tenant) throw new Error("[subject-key] workspaceSubdomain is required");

  const db = activeDb();
  const rows = await db
    .select({
      id: cryptoShreddingKeys.id,
      encryptedKey: cryptoShreddingKeys.encryptedKey,
      status: cryptoShreddingKeys.status,
    })
    .from(cryptoShreddingKeys)
    .where(
      and(
        eq(cryptoShreddingKeys.workspaceSubdomain, tenant),
        eq(cryptoShreddingKeys.subjectId, normalizedSubject),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  if (row.status === "SHREDDED") throw new SubjectKeyShreddedError(normalizedSubject);
  const decryptedHex = decryptSecretAtRest(row.encryptedKey);
  if (!decryptedHex) {
    throw new Error(`Failed to decrypt subject envelope key for "${normalizedSubject}".`);
  }
  return Buffer.from(decryptedHex, "hex");
}

/**
 * Retrieves an existing subject encryption key or generates a new one, scoped to
 * the workspace. Only encryption paths may call this; see
 * {@link getExistingSubjectKey} for reads.
 */
export async function getOrCreateSubjectKey(
  workspaceSubdomain: string,
  subjectId: string,
): Promise<Buffer> {
  const existing = await getExistingSubjectKey(workspaceSubdomain, subjectId);
  if (existing) return existing;

  const tenant = workspaceSubdomain.trim().toLowerCase();
  const normalizedSubject = subjectId.trim();

  const rawKey = crypto.randomBytes(32);
  const encryptedEnvelope = encryptSecretAtRest(rawKey.toString("hex"))!;
  const keyId = `csk_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  await activeDb().insert(cryptoShreddingKeys).values({
    id: keyId,
    workspaceSubdomain: tenant,
    subjectId: normalizedSubject,
    encryptedKey: encryptedEnvelope,
    algorithm: "AES-256-GCM",
    status: "ACTIVE",
    createdAt: new Date(),
  });

  return rawKey;
}

function encodeSubject(subjectId: string): string {
  return encodeURIComponent(subjectId);
}

function decodeSubject(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

/** Encrypts a personal-data field for a subject with its workspace-scoped key. */
export async function encryptSubjectData(
  workspaceSubdomain: string,
  subjectId: string,
  plaintext?: string | null,
): Promise<string | undefined> {
  if (!plaintext) return undefined;
  if (plaintext.startsWith(SUBJECT_ENC_PREFIX)) return plaintext;

  const key = await getOrCreateSubjectKey(workspaceSubdomain, subjectId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${SUBJECT_ENC_PREFIX}${encodeSubject(subjectId)}:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/** Decrypts a subject field; returns the shred marker once the key is destroyed. */
export async function decryptSubjectData(
  workspaceSubdomain: string,
  subjectId: string,
  ciphertext?: string | null,
): Promise<string | undefined> {
  if (!ciphertext) return undefined;
  if (!ciphertext.startsWith(SUBJECT_ENC_PREFIX)) return ciphertext;

  try {
    const key = await getExistingSubjectKey(workspaceSubdomain, subjectId);
    if (!key) {
      logger.warn(
        { subjectId },
        "[subject-key] encrypted state has no key; treating it as shredded",
      );
      return "[DATA_SHREDDED]";
    }
    const parts = ciphertext.slice(SUBJECT_ENC_PREFIX.length).split(":");
    if (parts.length < 4) return undefined;
    const dataHex = parts.pop()!;
    const tagHex = parts.pop()!;
    const ivHex = parts.pop()!;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof SubjectKeyShreddedError) return "[DATA_SHREDDED]";
    logger.warn(
      { err: error instanceof Error ? error.message : String(error) },
      "[subject-key] decrypt failed",
    );
    return "[DATA_SHREDDED]";
  }
}

/** Encrypts an already-canonical audit state string (or returns null). */
export async function encryptSubjectAuditState(
  workspaceSubdomain: string,
  subjectId: string,
  canonical: string | null,
): Promise<string | null> {
  if (canonical === null) return null;
  return (await encryptSubjectData(workspaceSubdomain, subjectId, canonical)) ?? null;
}

/**
 * Decrypts a stored audit state when it carries a subject envelope. The subject
 * id is encoded in the value, so callers only need the tenant.
 */
export async function decryptSubjectAuditState(
  workspaceSubdomain: string,
  stored: string | null,
): Promise<string | null> {
  if (!stored || !stored.startsWith(SUBJECT_ENC_PREFIX)) return stored;
  const parts = stored.slice(SUBJECT_ENC_PREFIX.length).split(":");
  const encodedSubject = parts.shift();
  if (!encodedSubject) return stored;
  const decrypted = await decryptSubjectData(
    workspaceSubdomain,
    decodeSubject(encodedSubject),
    stored,
  );
  return decrypted ?? null;
}

/** True when a stored audit state is subject-encrypted. */
export function isEncryptedSubjectState(value: string | null): boolean {
  return Boolean(value && value.startsWith(SUBJECT_ENC_PREFIX));
}

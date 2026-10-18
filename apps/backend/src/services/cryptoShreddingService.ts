import crypto, { createCipheriv, createDecipheriv } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AuditRetentionRegime } from "@mms/shared";
import { activeDb } from "../db/dbConnection.js";
import { cryptoShreddingKeys, auditErasureRequests } from "../db/schema/auditTrail.js";
import { encryptSecretAtRest, decryptSecretAtRest } from "../lib/cryptoAtRest.js";
import { recordModernAuditEvent } from "./auditTrailService.js";
import { logger } from "../lib/logger.js";

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
 * Retrieves an existing subject encryption key or generates a new one.
 * Subject keys are stored with envelope encryption using the MMS master at-rest key.
 */
export async function getOrCreateSubjectKey(subjectId: string): Promise<Buffer> {
  const normalizedSubject = subjectId.trim();
  const db = activeDb();

  const existingRows = await db
    .select({
      id: cryptoShreddingKeys.id,
      encryptedKey: cryptoShreddingKeys.encryptedKey,
      status: cryptoShreddingKeys.status,
    })
    .from(cryptoShreddingKeys)
    .where(eq(cryptoShreddingKeys.subjectId, normalizedSubject))
    .limit(1);

  if (existingRows.length > 0) {
    const row = existingRows[0];
    if (row.status === "SHREDDED") {
      throw new SubjectKeyShreddedError(normalizedSubject);
    }

    const decryptedHex = decryptSecretAtRest(row.encryptedKey);
    if (!decryptedHex) {
      throw new Error(`Failed to decrypt subject envelope key for "${normalizedSubject}".`);
    }
    return Buffer.from(decryptedHex, "hex");
  }

  // Generate new 256-bit key for this subject
  const rawKey = crypto.randomBytes(32);
  const encryptedEnvelope = encryptSecretAtRest(rawKey.toString("hex"))!;

  const keyId = `csk_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  await db.insert(cryptoShreddingKeys).values({
    id: keyId,
    subjectId: normalizedSubject,
    encryptedKey: encryptedEnvelope,
    algorithm: "AES-256-GCM",
    status: "ACTIVE",
    createdAt: new Date(),
  });

  return rawKey;
}

/**
 * Encrypts a personal data field for a subject using their dedicated encryption key.
 */
export async function encryptSubjectData(
  subjectId: string,
  plaintext?: string | null,
): Promise<string | undefined> {
  if (!plaintext) return undefined;
  if (plaintext.startsWith(SUBJECT_ENC_PREFIX)) return plaintext;

  const key = await getOrCreateSubjectKey(subjectId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${SUBJECT_ENC_PREFIX}${subjectId}:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypts a subject's encrypted personal data field.
 * Returns undefined if key was shredded or invalid.
 */
export async function decryptSubjectData(
  subjectId: string,
  ciphertext?: string | null,
): Promise<string | undefined> {
  if (!ciphertext) return undefined;
  if (!ciphertext.startsWith(SUBJECT_ENC_PREFIX)) return ciphertext;

  try {
    const key = await getOrCreateSubjectKey(subjectId);
    const parts = ciphertext.slice(SUBJECT_ENC_PREFIX.length).split(":");
    if (parts.length !== 4) return undefined;

    const [, ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    if (error instanceof SubjectKeyShreddedError) {
      // Key shredded: mathematically unrecoverable noise as intended by GDPR erasure
      return "[DATA_SHREDDED]";
    }
    return undefined;
  }
}

export interface ExecuteErasureOptions {
  subjectId: string;
  workspaceSubdomain: string;
  regime: AuditRetentionRegime;
  erasureType: "CRYPTO_SHRED" | "REDACT_APPEND";
  requestedBy: string;
  reason?: string;
}

/**
 * Executes a right-to-erasure request in strict accordance with modern audit trail standards:
 * Pattern A (Crypto-Shredding): Destroys the subject key, rendering audit row ciphertext permanently
 * unrecoverable mathematical noise while leaving historical hash chains 100% intact.
 * Pattern B (Redact-and-Append): Appends a new chained event with action_type = 'REDACT' without recomputing
 * historical hashes.
 */
export async function executeSubjectErasure(options: ExecuteErasureOptions): Promise<{
  erasureRequestId: string;
  subjectId: string;
  erasureType: "CRYPTO_SHRED" | "REDACT_APPEND";
  status: "COMPLETED";
}> {
  const { subjectId, workspaceSubdomain, regime, erasureType, requestedBy } = options;
  const requestId = `era_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date();
  const db = activeDb();

  if (erasureType === "CRYPTO_SHRED") {
    // 1. Destroy the subject key. Capture the affected rows: zero rows means no
    // subject key was ever created (subject data was never envelope-encrypted),
    // so the shred is a no-op and must be logged rather than reported silently.
    const shreddedRows = await db
      .update(cryptoShreddingKeys)
      .set({
        status: "SHREDDED",
        encryptedKey: "[SHREDDED_KEY_DESTROYED]",
        destroyedAt: now,
      })
      .where(eq(cryptoShreddingKeys.subjectId, subjectId))
      .returning({ id: cryptoShreddingKeys.id });

    if (shreddedRows.length === 0) {
      logger.warn(
        { requestId, subjectId, regime },
        "Crypto-shredding requested but no active subject key existed — nothing was shredded",
      );
    }

    // 2. Record erasure request
    await db.insert(auditErasureRequests).values({
      id: requestId,
      subjectId,
      regime,
      erasureType,
      requestedBy,
      requestedAt: now,
      completedAt: now,
      redactionMarker: "[CRYPTO_SHREDDED]",
    });

    // 3. Append an audit event documenting the shredding action
    await recordModernAuditEvent(db, {
      workspaceSubdomain,
      tableName: "crypto_shredding_keys",
      recordId: subjectId,
      actionType: "DELETE",
      realUserId: requestedBy,
      oldState: { subjectId, status: "ACTIVE" },
      newState: { subjectId, status: "SHREDDED", destroyedAt: now.toISOString() },
    });

    logger.info({ requestId, subjectId, regime }, "Crypto-shredding erasure executed successfully");
  } else {
    // Pattern B: Redact-and-Append
    await db.insert(auditErasureRequests).values({
      id: requestId,
      subjectId,
      regime,
      erasureType,
      requestedBy,
      requestedAt: now,
      completedAt: now,
      redactionMarker: "[REDACTED_PER_REQUEST]",
    });

    // Append a new chained row with action_type = 'REDACT'
    await recordModernAuditEvent(db, {
      workspaceSubdomain,
      tableName: "contacts",
      recordId: subjectId,
      actionType: "REDACT",
      realUserId: requestedBy,
      oldState: { subjectId, notice: "Subject personal data redacted per erasure request" },
      newState: { subjectId, redactionMarker: "[REDACTED_PER_REQUEST]" },
    });

    logger.info({ requestId, subjectId, regime }, "Redact-and-append erasure logged successfully");
  }

  return {
    erasureRequestId: requestId,
    subjectId,
    erasureType,
    status: "COMPLETED",
  };
}

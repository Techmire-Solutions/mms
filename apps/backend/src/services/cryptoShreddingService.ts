import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AuditRetentionRegime } from "@mms/shared";
import { activeDb } from "../db/dbConnection.js";
import { withTenant } from "../db/tenant-context.js";
import { auditErasureRequests, cryptoShreddingKeys } from "../db/schema/auditTrail.js";
import { recordModernAuditEvent } from "./auditTrailService.js";
import { logger } from "../lib/logger.js";

export {
  SubjectKeyShreddedError,
  getOrCreateSubjectKey,
  encryptSubjectData,
  decryptSubjectData,
  encryptSubjectAuditState,
  decryptSubjectAuditState,
  isEncryptedSubjectState,
} from "../lib/subjectKeyService.js";

export interface ExecuteErasureOptions {
  subjectId: string;
  workspaceSubdomain: string;
  regime: AuditRetentionRegime;
  erasureType: "CRYPTO_SHRED" | "REDACT_APPEND";
  requestedBy: string;
  reason?: string;
}

export type ErasureStatus = "COMPLETED" | "NO_KEY" | "APPEND_ONLY";

export interface ErasureResult {
  erasureRequestId: string;
  subjectId: string;
  erasureType: "CRYPTO_SHRED" | "REDACT_APPEND";
  status: ErasureStatus;
  message: string;
}

const NO_KEY_MESSAGE =
  "No subject encryption key exists for this subject. Nothing was shredded; " +
  "subject-level encryption has never been enabled for this record.";

/**
 * Executes a right-to-erasure request inside one tenant transaction:
 * Pattern A (crypto-shredding) destroys the subject key so encrypted state becomes
 * unrecoverable; Pattern B (redact-and-append) appends a REDACT marker without
 * rewriting historical hashes. Both record the request and the audit event in the
 * same transaction, and both are scoped to the caller's workspace.
 */
export async function executeSubjectErasure(
  options: ExecuteErasureOptions,
): Promise<ErasureResult> {
  const tenant = options.workspaceSubdomain.trim().toLowerCase();
  if (!tenant) throw new Error("[erasure] workspaceSubdomain is required");
  const { subjectId, regime, erasureType, requestedBy } = options;
  const requestId = `era_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date();

  const result = await withTenant(tenant, async () => {
    if (erasureType === "CRYPTO_SHRED") {
      const existing = await activeDb()
        .select({ id: cryptoShreddingKeys.id, status: cryptoShreddingKeys.status })
        .from(cryptoShreddingKeys)
        .where(
          and(
            eq(cryptoShreddingKeys.workspaceSubdomain, tenant),
            eq(cryptoShreddingKeys.subjectId, subjectId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        logger.warn(
          { requestId, subjectId, regime, tenant },
          "Crypto-shredding requested but no subject key existed — nothing was shredded",
        );
        return { status: "NO_KEY" as const, message: NO_KEY_MESSAGE };
      }

      await activeDb()
        .update(cryptoShreddingKeys)
        .set({
          status: "SHREDDED",
          encryptedKey: "[SHREDDED_KEY_DESTROYED]",
          destroyedAt: now,
        })
        .where(
          and(
            eq(cryptoShreddingKeys.workspaceSubdomain, tenant),
            eq(cryptoShreddingKeys.subjectId, subjectId),
          ),
        );

      await activeDb().insert(auditErasureRequests).values({
        id: requestId,
        workspaceSubdomain: tenant,
        subjectId,
        regime,
        erasureType,
        requestedBy,
        requestedAt: now,
        completedAt: now,
        redactionMarker: "[CRYPTO_SHREDDED]",
      });

      await recordModernAuditEvent({
        workspaceSubdomain: tenant,
        tableName: "crypto_shredding_keys",
        recordId: subjectId,
        actionType: "DELETE",
        realUserId: requestedBy,
        oldState: { subjectId, status: "ACTIVE" },
        newState: { subjectId, status: "SHREDDED", destroyedAt: now.toISOString() },
      });

      logger.info({ requestId, subjectId, regime, tenant }, "Crypto-shredding erasure executed");
      return { status: "COMPLETED" as const, message: "Subject key destroyed." };
    }

    await activeDb().insert(auditErasureRequests).values({
      id: requestId,
      workspaceSubdomain: tenant,
      subjectId,
      regime,
      erasureType,
      requestedBy,
      requestedAt: now,
      completedAt: now,
      redactionMarker: "[REDACTED_PER_REQUEST]",
    });

    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: "contacts",
      recordId: subjectId,
      actionType: "REDACT",
      realUserId: requestedBy,
      oldState: { subjectId, notice: "Subject personal data redacted per erasure request" },
      newState: { subjectId, redactionMarker: "[REDACTED_PER_REQUEST]" },
    });

    logger.info({ requestId, subjectId, regime, tenant }, "Redact-and-append erasure recorded");
    return {
      status: "APPEND_ONLY" as const,
      message:
        "Redaction marker appended. Historical audit hashes are immutable; encrypted state is only " +
        "unrecoverable where a subject key was used at capture.",
    };
  });

  return {
    erasureRequestId: requestId,
    subjectId,
    erasureType,
    status: result.status,
    message: result.message,
  };
}

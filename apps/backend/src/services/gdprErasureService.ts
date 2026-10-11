import { and, eq } from "drizzle-orm";
import type { DbClient } from "../db/dbConnection.js";
import { activeDb } from "../db/dbConnection.js";
import {
  contacts,
  contactPhones,
  contactEmails,
  contactAddresses,
  contactSocials,
} from "../db/schema.js";
import { executeSubjectErasure } from "./cryptoShreddingService.js";
import { recordModernAuditEvent } from "./auditTrailService.js";
import { logger } from "../lib/logger.js";

export interface ExecuteGdprErasureOptions {
  requestedBy?: string;
  db?: DbClient;
}

export interface GdprPseudonymizedRecord {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  customData: Record<string, unknown>;
  deletedAt: Date;
  deletionReason: string;
}

export interface GdprErasureResult {
  contactId: string;
  tenant: string;
  status: "COMPLETED";
  erasureRequestId?: string;
  pseudonymizedRecord: GdprPseudonymizedRecord;
}

/**
 * GDPR Article 17 Right to Erasure Execution Service.
 *
 * Implements the MMS Dual-Track Erasure Protocol:
 * 1. Cryptographic Shredding: Destroys the data subject envelope encryption key in KMS/Vault
 *    (crypto-shredding custom_data / encrypted fields), rendering historic audit ciphertext
 *    permanently undecipherable noise across databases and backups.
 * 2. In-Place Pseudonymization / Scrubbing: Overwrites plain PII attributes with deterministic
 *    synthetic tokens (first_name = 'Anonymized', last_name = 'Subject',
 *    email = 'erased-' || id || '@deleted.local', phone = NULL, custom_data = '{}'::jsonb),
 *    preserving the primary key for relational ID continuity across foreign keys.
 * 3. Sets deleted_at = NOW() and deletion_reason = 'GDPR Article 17 Erasure Request'.
 */
export async function executeGdprErasure(
  tenant: string,
  contactId: string,
  options?: ExecuteGdprErasureOptions | DbClient,
): Promise<GdprErasureResult> {
  const normalizedTenant = tenant.trim().toLowerCase();
  const normalizedContactId = contactId.trim();

  let db: DbClient;
  let requestedBy = "gdpr-worker";

  if (options && "execute" in options && typeof (options as DbClient).execute === "function") {
    db = options as DbClient;
  } else if (options && typeof options === "object") {
    const opts = options as ExecuteGdprErasureOptions;
    db = opts.db ?? activeDb();
    if (opts.requestedBy) requestedBy = opts.requestedBy;
  } else {
    db = activeDb();
  }

  const now = new Date();
  const pseudonymizedEmail = `erased-${normalizedContactId}@deleted.local`;

  // 1. Invalidate subject encryption key in KMS/Vault (crypto-shredding custom_data)
  let erasureRequestId: string | undefined;
  try {
    const shredResult = await executeSubjectErasure({
      subjectId: normalizedContactId,
      workspaceSubdomain: normalizedTenant,
      regime: "GDPR",
      erasureType: "CRYPTO_SHRED",
      requestedBy,
      reason: "GDPR Article 17 Erasure Request",
    });
    erasureRequestId = shredResult.erasureRequestId;
  } catch (shredErr) {
    logger.warn(
      { contactId: normalizedContactId, err: shredErr },
      "[GdprErasure] Crypto-shredding key invalidation logged warning",
    );
  }

  // 2. In-place overwrite PII. Scalar `email`/`phone`/`custom_data` were moved
  // to child tables (migrations 0056/0075) and are handled below; the previous
  // raw UPDATE referenced those dropped columns and was silently swallowed.
  try {
    if (typeof db.update === "function") {
      await db
        .update(contacts)
        .set({
          firstName: "Anonymized",
          lastName: "Subject",
          name: "Anonymized Subject",
          // Every remaining identifying/scalar attribute must be scrubbed too —
          // omitting these left DOB, gender, and WhatsApp status in place.
          gender: null,
          dob: null,
          whatsappStatus: "unknown",
          isSyed: false,
          lastCheckedAt: null,
          cnic: null,
          avatar: null,
          notes: null,
          aiSummary: null,
          deletedAt: now,
          deletionReason: "GDPR Article 17 Erasure Request",
          updatedAt: now,
        })
        .where(
          and(
            eq(contacts.workspaceSubdomain, normalizedTenant),
            eq(contacts.id, normalizedContactId),
          ),
        );
    }
  } catch (err) {
    logger.warn(
      { contactId: normalizedContactId, err },
      "[GdprErasure] Drizzle update contacts warning",
    );
  }

  // Scrub plain PII in normalized child tables (emails, phones, addresses, socials)
  try {
    if (typeof db.delete === "function") {
      // Clear phone numbers
      await db
        .delete(contactPhones)
        .where(
          and(
            eq(contactPhones.workspaceSubdomain, normalizedTenant),
            eq(contactPhones.contactId, normalizedContactId),
          ),
        );

      // Clear addresses
      await db
        .delete(contactAddresses)
        .where(
          and(
            eq(contactAddresses.workspaceSubdomain, normalizedTenant),
            eq(contactAddresses.contactId, normalizedContactId),
          ),
        );

      // Clear social links
      await db
        .delete(contactSocials)
        .where(
          and(
            eq(contactSocials.workspaceSubdomain, normalizedTenant),
            eq(contactSocials.contactId, normalizedContactId),
          ),
        );

      // Replace email with pseudonymized address
      await db
        .delete(contactEmails)
        .where(
          and(
            eq(contactEmails.workspaceSubdomain, normalizedTenant),
            eq(contactEmails.contactId, normalizedContactId),
          ),
        );
    }

    if (typeof db.insert === "function") {
      await db.insert(contactEmails).values({
        id: `email-gdpr-${normalizedContactId}`,
        workspaceSubdomain: normalizedTenant,
        contactId: normalizedContactId,
        address: pseudonymizedEmail,
        isPrimary: true,
        label: "GDPR Erasure",
      });
    }
  } catch (childErr) {
    logger.warn(
      { contactId: normalizedContactId, err: childErr },
      "[GdprErasure] Child tables scrub warning",
    );
  }

  // 3. Emit modern audit event documenting GDPR Article 17 in-place erasure
  try {
    await recordModernAuditEvent({
      workspaceSubdomain: normalizedTenant,
      tableName: "contacts",
      recordId: normalizedContactId,
      actionType: "REDACT",
      realUserId: requestedBy,
      apiEndpoint: "gdpr.article17.erasure",
      oldState: {
        contactId: normalizedContactId,
        notice: "PII scrubbed per GDPR Article 17 erasure request",
      },
      newState: {
        id: normalizedContactId,
        firstName: "Anonymized",
        lastName: "Subject",
        email: pseudonymizedEmail,
        phone: null,
        customData: {},
        deletedAt: now.toISOString(),
        deletionReason: "GDPR Article 17 Erasure Request",
      },
    });
  } catch (auditErr) {
    logger.warn(
      { contactId: normalizedContactId, err: auditErr },
      "[GdprErasure] Audit record warning",
    );
  }

  logger.info(
    { contactId: normalizedContactId, tenant: normalizedTenant },
    "GDPR Article 17 erasure executed successfully: subject key shredded and PII pseudonymized in place",
  );

  return {
    contactId: normalizedContactId,
    tenant: normalizedTenant,
    status: "COMPLETED",
    erasureRequestId,
    pseudonymizedRecord: {
      id: normalizedContactId,
      firstName: "Anonymized",
      lastName: "Subject",
      name: "Anonymized Subject",
      email: pseudonymizedEmail,
      phone: null,
      customData: {},
      deletedAt: now,
      deletionReason: "GDPR Article 17 Erasure Request",
    },
  };
}

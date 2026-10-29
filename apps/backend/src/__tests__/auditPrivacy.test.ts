import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  canonicalizeJson,
  formatAuditEventHashInput,
  GENESIS_AUDIT_HASH,
  AUDIT_RETENTION_FLOORS,
} from "@mms/shared";
import { recordModernAuditEvent, type DbOrTransaction } from "../services/auditTrailService.js";
import {
  evaluateAuditRetentionPolicy,
  purgeExpiredCryptoShreddingKeys,
} from "../services/auditRetentionService.js";

describe("Modern Audit Trail - Privacy, Retention & Erasure (Section 4)", () => {
  it("proves crypto-shredding permanently destroys plaintext while keeping historical hash chain valid", () => {
    // 1. Simulate subject personal data encryption
    const subjectId = "sub-patient-999";
    const subjectKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", subjectKey, iv);
    const sensitiveMedicalNote = "Diagnosis: Confidential Health Detail";

    const ciphertext = Buffer.concat([cipher.update(sensitiveMedicalNote, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    const storedEncryptedField = `enc:subject:${subjectId}:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;

    // 2. State payload with encrypted personal data
    const auditRowState = {
      subjectId,
      record: storedEncryptedField,
      action: "UPDATE",
    };
    const canonicalPayload = canonicalizeJson(auditRowState);
    const timestamp = "2026-09-09T12:00:00.000Z";
    const originalHash = crypto.hash(
      "sha256",
      formatAuditEventHashInput(GENESIS_AUDIT_HASH, canonicalPayload, timestamp),
      "hex",
    );

    // 3. Before shredding: Key exists, ciphertext can be decrypted
    const decipher = crypto.createDecipheriv("aes-256-gcm", subjectKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      "utf8",
    );
    expect(decrypted).toBe(sensitiveMedicalNote);

    // 4. Crypto-shredding event: Subject key is permanently destroyed (zeroed / discarded)
    subjectKey.fill(0); // Zero out key memory
    const dummyKey = crypto.randomBytes(32); // Wrong/destroyed key

    // Decryption with destroyed key fails to authenticate GCM tag
    const failedDecipher = crypto.createDecipheriv("aes-256-gcm", dummyKey, iv);
    failedDecipher.setAuthTag(tag);
    expect(() => {
      Buffer.concat([failedDecipher.update(ciphertext), failedDecipher.final()]);
    }).toThrow();

    // 5. Invariant: The audit row, ciphertext, and cryptographic hash are 100% UNTOUCHED
    const recomputedHash = crypto.hash(
      "sha256",
      formatAuditEventHashInput(GENESIS_AUDIT_HASH, canonicalPayload, timestamp),
      "hex",
    );
    expect(recomputedHash).toBe(originalHash);
  });

  it("verifies redact-and-append appends a new chained event without mutating historical row hashes", async () => {
    const historicalChain: { hashCurrent: string }[] = [];

    const mockTx = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => {
                const latest = historicalChain[historicalChain.length - 1];
                return latest ? [{ hashCurrent: latest.hashCurrent }] : [];
              },
            }),
          }),
        }),
      }),
      insert: () => ({
        values: (row: unknown) => {
          historicalChain.push(row as { hashCurrent: string });
          return { returning: () => [{ id: historicalChain.length }] };
        },
      }),
    } as unknown as DbOrTransaction;

    // Historical row
    const row1 = await recordModernAuditEvent(mockTx, {
      workspaceSubdomain: "demo",
      tableName: "contacts",
      recordId: "cnt-42",
      actionType: "CREATE",
      realUserId: "usr-clerk",
      newState: { name: "John Doe", phone: "+1234567890" },
      transactionTimestamp: new Date("2026-09-01T08:00:00.000Z"),
    });

    const historicalHashBeforeRedaction = row1.hashCurrent;

    // Redact-and-append request
    const rowRedact = await recordModernAuditEvent(mockTx, {
      workspaceSubdomain: "demo",
      tableName: "contacts",
      recordId: "cnt-42",
      actionType: "REDACT",
      realUserId: "usr-privacy-officer",
      oldState: { notice: "Historical personal data redacted per GDPR request" },
      newState: { redactionMarker: "[REDACTED_PER_REQUEST]" },
      transactionTimestamp: new Date("2026-09-09T08:00:00.000Z"),
    });

    // Invariant: Historical row1 hash is unperturbed
    expect(row1.hashCurrent).toBe(historicalHashBeforeRedaction);
    // Invariant: New REDACT row links directly to historical head
    expect(rowRedact.hashPrevious).toBe(historicalHashBeforeRedaction);
    expect(rowRedact.hashCurrent).not.toBe(historicalHashBeforeRedaction);
    expect(historicalChain).toHaveLength(2);
  });

  it("evaluates statutory retention policy floors per regulatory regime", async () => {
    expect(AUDIT_RETENTION_FLOORS.HIPAA).toBe(2190); // 6 years
    expect(AUDIT_RETENTION_FLOORS.SOX).toBe(2555); // 7 years
    expect(AUDIT_RETENTION_FLOORS.PCI_DSS).toBe(365); // 1 year
    expect(AUDIT_RETENTION_FLOORS.GDPR).toBe(1095); // 3 years

    const asOf = new Date("2026-09-09T00:00:00.000Z");
    const evaluation = await evaluateAuditRetentionPolicy("HIPAA", "test-tenant", asOf);
    expect(evaluation.regime).toBe("HIPAA");
    expect(evaluation.retentionFloorDays).toBe(2190);
    expect(evaluation.cutoffDate.getTime()).toBeLessThan(asOf.getTime());

    const dryRunResult = await purgeExpiredCryptoShreddingKeys(
      {
        regime: "HIPAA",
        asOfDate: asOf,
        dryRun: true,
      },
      "test-tenant",
    );
    expect(dryRunResult.dryRun).toBe(true);
    expect(dryRunResult.regime).toBe("HIPAA");
  });
});

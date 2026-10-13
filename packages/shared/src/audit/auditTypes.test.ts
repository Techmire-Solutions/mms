import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_RETENTION_REGIMES,
  AUDIT_STORAGE_TIERS,
  AUDIT_VERIFICATION_STATUSES,
  auditErasureRequestSchema,
  cryptoShreddingKeySchema,
  modernAuditEventInsertSchema,
  modernAuditEventSchema,
  calculateStateDelta,
} from "./auditTypes.js";

describe("auditTypes", () => {
  it("defines all canonical audit action types", () => {
    expect(AUDIT_ACTION_TYPES).toEqual([
      "CREATE",
      "UPDATE",
      "DELETE",
      "VIEW",
      "LOGIN",
      "REDACT",
      "RESTORE",
    ]);
  });

  it("defines canonical audit verification statuses", () => {
    expect(AUDIT_VERIFICATION_STATUSES).toEqual([
      "VERIFIED",
      "PENDING",
      "BROKEN_CHAIN",
      "SEQUENCE_GAP",
      "TAMPERED",
    ]);
  });

  it("defines canonical storage tiers and retention regimes", () => {
    expect(AUDIT_STORAGE_TIERS).toEqual(["HOT", "WARM", "COLD"]);
    expect(AUDIT_RETENTION_REGIMES).toEqual(["HIPAA", "SOX", "PCI_DSS", "GDPR"]);
  });

  it("validates a complete 5-dimension modern audit event", () => {
    const validEvent = {
      id: "evt-1001",
      workspaceSubdomain: "demo",
      tableName: "contacts",
      recordId: "cnt-500",
      actionType: "UPDATE",
      realUserId: "usr-admin",
      impersonatedUserId: null,
      ipAddress: "192.168.1.1",
      clientApp: "mms-web",
      sessionId: "sess-abc",
      correlationId: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      apiEndpoint: "/api/contacts/cnt-500",
      httpMethod: "PUT",
      oldState: '{"email":"old@example.com","name":"Old"}',
      newState: '{"email":"new@example.com","name":"New"}',
      hashPrevious: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      hashCurrent: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
      verificationStatus: "VERIFIED",
      transactionTimestamp: "2026-09-09T01:00:00.000000Z",
    };

    const parsed = modernAuditEventSchema.parse(validEvent);
    expect(parsed.recordId).toBe("cnt-500");
    expect(parsed.actionType).toBe("UPDATE");
    expect(parsed.correlationId).toBe(validEvent.correlationId);
  });

  it("validates modernAuditEventInsertSchema omitting id and defaulting verificationStatus", () => {
    const insertPayload = {
      workspaceSubdomain: "demo",
      tableName: "students",
      recordId: "stu-10",
      actionType: "CREATE",
      realUserId: "usr-1",
      correlationId: "00-traceparent-01",
      hashPrevious: "0000000000000000000000000000000000000000000000000000000000000000",
      hashCurrent: "1111111111111111111111111111111111111111111111111111111111111111",
      transactionTimestamp: "2026-09-09T01:05:00.000000Z",
    };

    const parsed = modernAuditEventInsertSchema.parse(insertPayload);
    expect(parsed.verificationStatus).toBe("VERIFIED");
    expect(parsed.tableName).toBe("students");
  });

  it("validates cryptoShreddingKeySchema and status transitions", () => {
    const activeKey = {
      id: "key-101",
      subjectId: "sub-contact-999",
      encryptedKey: "enc_base64_secret_key_material",
      algorithm: "AES-256-GCM" as const,
      status: "ACTIVE" as const,
      createdAt: "2026-09-09T00:00:00.000Z",
    };
    const parsed = cryptoShreddingKeySchema.parse(activeKey);
    expect(parsed.status).toBe("ACTIVE");

    const shreddedKey = {
      ...activeKey,
      status: "SHREDDED" as const,
      destroyedAt: "2026-09-09T02:00:00.000Z",
    };
    const parsedShredded = cryptoShreddingKeySchema.parse(shreddedKey);
    expect(parsedShredded.status).toBe("SHREDDED");
    expect(parsedShredded.destroyedAt).toBe("2026-09-09T02:00:00.000Z");
  });

  it("validates auditErasureRequestSchema for crypto-shredding and redact-and-append", () => {
    const cryptoShredRequest = {
      id: "erasure-1",
      subjectId: "sub-student-456",
      regime: "GDPR" as const,
      erasureType: "CRYPTO_SHRED" as const,
      requestedBy: "dpo@example.com",
      requestedAt: "2026-09-09T01:00:00.000Z",
    };
    const parsed = auditErasureRequestSchema.parse(cryptoShredRequest);
    expect(parsed.erasureType).toBe("CRYPTO_SHRED");
    expect(parsed.redactionMarker).toBe("[REDACTED_PER_REQUEST]");

    const redactAppendRequest = {
      id: "erasure-2",
      subjectId: "sub-contact-123",
      regime: "HIPAA" as const,
      erasureType: "REDACT_APPEND" as const,
      requestedBy: "compliance@example.com",
      requestedAt: "2026-09-09T01:30:00.000Z",
      completedAt: "2026-09-09T01:35:00.000Z",
      redactionMarker: "[REDACTED_HIPAA]",
    };
    const parsedRedact = auditErasureRequestSchema.parse(redactAppendRequest);
    expect(parsedRedact.erasureType).toBe("REDACT_APPEND");
    expect(parsedRedact.redactionMarker).toBe("[REDACTED_HIPAA]");
  });

  describe("calculateStateDelta", () => {
    it("returns null deltas when objects are identical", () => {
      const state = { name: "Alice", role: "admin", age: 30 };
      const { oldDelta, newDelta } = calculateStateDelta(state, { ...state });
      expect(oldDelta).toBeNull();
      expect(newDelta).toBeNull();
    });

    it("extracts only changed keys for minimal delta capture", () => {
      const oldState = { name: "Alice", status: "ACTIVE", note: "stable" };
      const newState = { name: "Alice", status: "SUSPENDED", note: "stable" };
      const { oldDelta, newDelta } = calculateStateDelta(oldState, newState);
      expect(oldDelta).toEqual({ status: "ACTIVE" });
      expect(newDelta).toEqual({ status: "SUSPENDED" });
    });

    it("handles created state when oldState is null", () => {
      const newState = { name: "Bob", role: "student" };
      const { oldDelta, newDelta } = calculateStateDelta(null, newState);
      expect(oldDelta).toBeNull();
      expect(newDelta).toEqual(newState);
    });

    it("handles deleted state when newState is null", () => {
      const oldState = { name: "Bob", role: "student" };
      const { oldDelta, newDelta } = calculateStateDelta(oldState, null);
      expect(oldDelta).toEqual(oldState);
      expect(newDelta).toBeNull();
    });
  });
});

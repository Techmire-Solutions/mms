import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { canonicalizeJson, formatAuditEventHashInput, GENESIS_AUDIT_HASH } from "@mms/shared";

import {
  recordModernAuditEvent,
  sanitizeAuditState,
  type DbOrTransaction,
} from "../services/auditTrailService.js";
import { buildMerkleRoot } from "../services/auditVerificationService.js";
import { tracer, parseTraceParent } from "../config/telemetry.js";
import { bindRequestUserId, bindRequestAuditContext } from "../lib/tenantContext.js";

describe("Modern Audit Trail - RFC 8785 & Cryptographic Chaining", () => {
  it("sanitizes secrets at capture time to minimize PII and avoid credential leaks", () => {
    const rawState = {
      id: "usr-123",
      name: "Admin User",
      password: "SuperSecretPassword!123",
      passwordHash: "$2b$12$e8x...xyz",
      refreshToken: "rt-abc-123",
      nested: {
        apiKey: "sk-secret-key",
        allowedScopes: ["admin", "users"],
      },
    };

    const sanitized = sanitizeAuditState(rawState) as any;
    expect(sanitized.name).toBe("Admin User");
    expect(sanitized.password).toBe("[REDACTED_SECRET]");
    expect(sanitized.passwordHash).toBe("[REDACTED_SECRET]");
    expect(sanitized.refreshToken).toBe("[REDACTED_SECRET]");
    expect(sanitized.nested.apiKey).toBe("[REDACTED_SECRET]");
    expect(sanitized.nested.allowedScopes).toEqual(["admin", "users"]);
  });

  it("computes deterministic Merkle roots across shard heads", () => {
    expect(buildMerkleRoot([])).toBe(GENESIS_AUDIT_HASH);

    const singleLeaf = "a".repeat(64);
    expect(buildMerkleRoot([singleLeaf])).toBe(singleLeaf);

    const leafA = "a".repeat(64);
    const leafB = "b".repeat(64);
    // Leaves are sorted: leafA, leafB
    const expectedTwoLeafRoot = crypto.hash("sha256", `${leafA}${leafB}`, "hex");
    expect(buildMerkleRoot([leafB, leafA])).toBe(expectedTwoLeafRoot);

    // Three leaves: sorted, third leaf is paired with itself in odd level
    const leafC = "c".repeat(64);
    const rootThree = buildMerkleRoot([leafA, leafB, leafC]);
    expect(rootThree).toHaveLength(64);
  });

  it("generates sequential sharded hash chain with formula SHA-256(previous + canonical_json + timestamp)", async () => {
    const mockEvents: any[] = [];

    const mockTx = {
      select: () => ({
        from: () => ({
          where: (_subdomainEq: any) => ({
            orderBy: () => ({
              limit: (_n: number) => {
                const latest = mockEvents[mockEvents.length - 1];
                return latest ? [{ hashCurrent: latest.hashCurrent }] : [];
              },
            }),
          }),
        }),
      }),
      insert: () => ({
        values: (data: any) => {
          mockEvents.push(data);
          return {
            returning: () => [{ id: mockEvents.length }],
          };
        },
      }),
    } as unknown as DbOrTransaction;

    const fixedTime1 = new Date("2026-09-09T10:00:00.000Z");
    const fixedTime2 = new Date("2026-09-09T10:05:00.000Z");

    // Event 1 (Genesis event in tenant shard)
    const res1 = await recordModernAuditEvent(mockTx, {
      workspaceSubdomain: "demo",
      tableName: "students",
      recordId: "stu-1",
      actionType: "CREATE",
      realUserId: "usr-admin",
      correlationId: "00-trace-01",
      newState: { firstName: "Ali", lastName: "Khan", classId: "cls-10" },
      transactionTimestamp: fixedTime1,
    });

    expect(res1.hashPrevious).toBe(GENESIS_AUDIT_HASH);
    expect(res1.hashCurrent).toHaveLength(64);

    // Verify hash formula mathematically: SHA-256(hashPrevious + canonicalPayload + timestamp)
    const expectedHash1 = crypto.hash(
      "sha256",
      formatAuditEventHashInput(
        GENESIS_AUDIT_HASH,
        res1.canonicalPayload,
        fixedTime1.toISOString(),
      ),
      "hex",
    );
    expect(res1.hashCurrent).toBe(expectedHash1);

    // Event 2 (Chained to Event 1)
    const res2 = await recordModernAuditEvent(mockTx, {
      workspaceSubdomain: "demo",
      tableName: "students",
      recordId: "stu-1",
      actionType: "UPDATE",
      realUserId: "usr-admin",
      correlationId: "00-trace-02",
      oldState: { firstName: "Ali", lastName: "Khan", classId: "cls-10" },
      newState: { firstName: "Ali", lastName: "Khan", classId: "cls-11" },
      transactionTimestamp: fixedTime2,
    });

    // Hash continuity: hashPrevious of Event 2 MUST equal hashCurrent of Event 1
    expect(res2.hashPrevious).toBe(res1.hashCurrent);

    const expectedHash2 = crypto.hash(
      "sha256",
      formatAuditEventHashInput(res1.hashCurrent, res2.canonicalPayload, fixedTime2.toISOString()),
      "hex",
    );
    expect(res2.hashCurrent).toBe(expectedHash2);
    expect(mockEvents).toHaveLength(2);
  });

  it("detects tampering when an event payload is altered after writing", () => {
    const hashPrevious = GENESIS_AUDIT_HASH;
    const originalPayload = {
      actionType: "UPDATE",
      apiEndpoint: "/api/students/stu-1",
      clientApp: "mms-web",
      correlationId: "00-trace-01",
      httpMethod: "PUT",
      impersonatedUserId: null,
      ipAddress: "127.0.0.1",
      newState: '{"fee":100}',
      oldState: '{"fee":50}',
      realUserId: "usr-admin",
      recordId: "stu-1",
      sessionId: "sess-1",
      tableName: "students",
      workspaceSubdomain: "demo",
    };

    const timestamp = "2026-09-09T10:00:00.000Z";
    const canonicalOriginal = canonicalizeJson(originalPayload);
    const validHash = crypto.hash(
      "sha256",
      formatAuditEventHashInput(hashPrevious, canonicalOriginal, timestamp),
      "hex",
    );

    // Attacker modifies newState from 100 to 0
    const tamperedPayload = {
      ...originalPayload,
      newState: '{"fee":0}',
    };
    const canonicalTampered = canonicalizeJson(tamperedPayload);
    const tamperedHash = crypto.hash(
      "sha256",
      formatAuditEventHashInput(hashPrevious, canonicalTampered, timestamp),
      "hex",
    );

    expect(tamperedHash).not.toBe(validHash);
  });

  it("auto-binds W3C traceparent and requestUserId when correlationId and realUserId are omitted", async () => {
    let insertedRow: any = null;
    const mockTx = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => [],
            }),
          }),
        }),
      }),
      insert: () => ({
        values: (row: any) => {
          insertedRow = row;
          return { returning: () => [{ id: 1 }] };
        },
      }),
    } as unknown as DbOrTransaction;

    bindRequestUserId("usr-context-user");

    const traceParentHeader = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const spanContext = parseTraceParent(traceParentHeader)!;

    await tracer.withSpan(
      "test.audit.span",
      {},
      async () => {
        await recordModernAuditEvent(mockTx, {
          workspaceSubdomain: "demo",
          tableName: "users",
          recordId: "usr-context-user",
          actionType: "LOGIN",
        });
      },
      spanContext,
    );

    expect(insertedRow).not.toBeNull();
    expect(insertedRow.realUserId).toBe("usr-context-user");
    expect(insertedRow.correlationId).toMatch(/^00-4bf92f3577b34da6a3ce929d0e0e4736-/);
  });

  it("auto-binds full HTTP metadata from requestAuditContextStorage", async () => {
    let insertedRow: any = null;
    const mockTx = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => [],
            }),
          }),
        }),
      }),
      insert: () => ({
        values: (row: any) => {
          insertedRow = row;
          return { returning: () => [{ id: 1 }] };
        },
      }),
    } as unknown as DbOrTransaction;

    bindRequestAuditContext({
      correlationId: "00-feedbeef123456781234567812345678-abcdef1234567890-01",
      ipAddress: "203.0.113.195",
      clientApp: "Mozilla/5.0 MMS-Client",
      sessionId: "jti-token-xyz",
      apiEndpoint: "/api/students/stu-99",
      httpMethod: "PATCH",
    });

    await recordModernAuditEvent(mockTx, {
      workspaceSubdomain: "demo",
      tableName: "students",
      recordId: "stu-99",
      actionType: "UPDATE",
      realUserId: "usr-clerk",
    });

    expect(insertedRow).not.toBeNull();
    expect(insertedRow.correlationId).toBe(
      "00-feedbeef123456781234567812345678-abcdef1234567890-01",
    );
    expect(insertedRow.ipAddress).toBe("203.0.113.195");
    expect(insertedRow.clientApp).toBe("Mozilla/5.0 MMS-Client");
    expect(insertedRow.sessionId).toBe("jti-token-xyz");
    expect(insertedRow.apiEndpoint).toBe("/api/students/stu-99");
    expect(insertedRow.httpMethod).toBe("PATCH");

    // Clean up
    bindRequestAuditContext(null);
  });

  it("minimizes capture state delta when minimizeDelta option is true", async () => {
    let insertedRow: any = null;
    const mockTx = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => [],
            }),
          }),
        }),
      }),
      insert: () => ({
        values: (row: any) => {
          insertedRow = row;
          return { returning: () => [{ id: 1 }] };
        },
      }),
    } as unknown as DbOrTransaction;

    const oldState = {
      firstName: "Hamza",
      lastName: "Iqbal",
      emergencyContact: "+923001234567",
      status: "ACTIVE",
    };
    const newState = {
      firstName: "Hamza",
      lastName: "Iqbal",
      emergencyContact: "+923001234567",
      status: "GRADUATED",
    };

    await recordModernAuditEvent(mockTx, {
      workspaceSubdomain: "demo",
      tableName: "students",
      recordId: "stu-55",
      actionType: "UPDATE",
      realUserId: "usr-admin",
      oldState,
      newState,
      minimizeDelta: true,
    });

    expect(insertedRow).not.toBeNull();
    // oldState and newState canonical JSON should only contain the modified 'status' field!
    expect(JSON.parse(insertedRow.oldState)).toEqual({ status: "ACTIVE" });
    expect(JSON.parse(insertedRow.newState)).toEqual({ status: "GRADUATED" });
  });
});

import { describe, expect, it } from "vitest";
import type {
  AuditListResponse,
  AuditVerificationResult,
  AuditExportPayload,
  AuditMerkleRootsResponse,
  AuditErasureResponse,
} from "./auditResponses.js";

describe("auditResponses", () => {
  it("supports typed AuditListResponse, AuditVerificationResult, and AuditExportPayload", () => {
    const listRes: AuditListResponse = {
      items: [],
      total: 0,
      limit: 25,
      offset: 0,
    };
    expect(listRes.total).toBe(0);

    const verifyRes: AuditVerificationResult = {
      runId: "run-1",
      workspaceSubdomain: "demo",
      status: "VERIFIED",
      recordsChecked: 10,
      discrepancies: [],
      headHash: "abc",
    };
    expect(verifyRes.status).toBe("VERIFIED");

    const exportPayload: AuditExportPayload = {
      metadata: {
        workspaceSubdomain: "demo",
        exportedAt: "2026-09-28T00:00:00.000Z",
        exportedBy: "usr-1",
        shardHeadHash: "abc",
        lastVerificationStatus: "VERIFIED",
        lastVerificationAt: null,
      },
      events: [],
    };
    expect(exportPayload.metadata.workspaceSubdomain).toBe("demo");
  });

  it("supports typed AuditMerkleRootsResponse and AuditErasureResponse", () => {
    const rootsRes: AuditMerkleRootsResponse = {
      items: [],
    };
    expect(rootsRes.items).toEqual([]);

    const erasureRes: AuditErasureResponse = {
      erasureRequestId: "era-123",
      subjectId: "sub-456",
      erasureType: "CRYPTO_SHRED",
      status: "COMPLETED",
    };
    expect(erasureRes.status).toBe("COMPLETED");
  });
});

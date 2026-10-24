/**
 * @file auditResponses.ts
 * @description API response envelope types for audit trail endpoints (events list, integrity verification, export).
 */

import type { AuditMerkleRoot, AuditVerificationStatus, ModernAuditEvent } from "./auditTypes.js";

/** Paginated audit event list API response envelope. */
export interface AuditListResponse {
  items: ModernAuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

/** Audit chain cryptographic verification result. */
export interface AuditVerificationResult {
  runId: string;
  workspaceSubdomain: string;
  status: AuditVerificationStatus;
  recordsChecked: number;
  discrepancies: string[];
  headHash: string;
}

/** Tamper-evident audit report export payload. */
export interface AuditExportPayload {
  metadata: {
    workspaceSubdomain: string;
    exportedAt: string;
    exportedBy: string;
    shardHeadHash: string;
    lastVerificationStatus: AuditVerificationStatus;
    lastVerificationAt: string | null;
  };
  events: ModernAuditEvent[];
}

/** Merkle roots checkpoint list response envelope. */
export interface AuditMerkleRootsResponse {
  items: AuditMerkleRoot[];
}

/** Privacy / right-to-erasure execution response. */
export interface AuditErasureResponse {
  erasureRequestId: string;
  subjectId: string;
  erasureType: "CRYPTO_SHRED" | "REDACT_APPEND";
  status: "COMPLETED";
}

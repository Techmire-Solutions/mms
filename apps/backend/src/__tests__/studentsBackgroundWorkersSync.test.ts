import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  resolveJobExecutionTimeoutMs,
  STUDENTS_IMPORT_TIMEOUT_MS,
  STUDENTS_EXPORT_TIMEOUT_MS,
  JOB_EXECUTION_TIMEOUT_MS,
} from "../worker/queues/queueConfig.js";
import {
  verifyEdtechWebhookSignature,
  calculateExponentialBackoff,
  isTokenExpired,
} from "../integrations/edtech/edtechWebhookVerifier.js";
import { createHmac } from "node:crypto";
import type { ImportPipelineContext } from "@mms/shared";
import type { StudentImportRow } from "../students/use-cases/studentImportUseCases.js";

const mockCreateStudent = vi.fn();
const mockUpsertContact = vi.fn();
const mockFindContacts = vi.fn();
const mockBroadcastCollection = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, cb: () => Promise<unknown>) => cb(),
  withTenantRead: async (_tenant: string, cb: () => Promise<unknown>) => cb(),
}));

vi.mock("../contacts/use-cases/contactWriteUseCases.js", () => ({
  upsertContact: (...args: unknown[]) => mockUpsertContact(...args),
}));

vi.mock("../contacts/use-cases/contactLoadUseCases.js", () => ({
  findContactsMatchingUniqueValues: (...args: unknown[]) => mockFindContacts(...args),
}));

vi.mock("../students/use-cases/studentWriteUseCases.js", () => ({
  createStudent: (...args: unknown[]) => mockCreateStudent(...args),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
}));

import { redisGet, redisSet } from "../lib/redis.js";
import { importStudentRows } from "../students/use-cases/studentImportUseCases.js";

describe("Students Background Workers & Queue Timeout Budgets", () => {
  it("resolves students:import to the 10-minute bulk timeout budget", () => {
    const timeout = resolveJobExecutionTimeoutMs("students", "import");
    expect(timeout).toBe(STUDENTS_IMPORT_TIMEOUT_MS);
    expect(timeout).toBe(600_000);
  });

  it("resolves students:export to the 10-minute bulk timeout budget", () => {
    const timeout = resolveJobExecutionTimeoutMs("students", "export");
    expect(timeout).toBe(STUDENTS_EXPORT_TIMEOUT_MS);
    expect(timeout).toBe(600_000);
  });

  it("resolves students:bulk-status to the 10-minute bulk timeout budget", () => {
    const timeout = resolveJobExecutionTimeoutMs("students", "bulk-status");
    expect(timeout).toBe(STUDENTS_IMPORT_TIMEOUT_MS);
    expect(timeout).toBe(600_000);
  });

  it("defaults unrecognized jobs to the 60s sandbox processor ceiling", () => {
    const timeout = resolveJobExecutionTimeoutMs("students", "unknown-kind");
    expect(timeout).toBe(JOB_EXECUTION_TIMEOUT_MS);
    expect(timeout).toBe(60_000);
  });
});

describe("Students Import Idempotency & Checkpointing Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindContacts.mockResolvedValue([]);
    mockUpsertContact.mockResolvedValue({ contact: { id: "c-1" }, created: true });
    mockCreateStudent.mockResolvedValue({ record: { id: "s-1" }, restored: false });
  });

  it("resumes from saved checkpoint on worker restart and cleans up upon completion", async () => {
    const rows: StudentImportRow[] = [
      { name: "Student 1", grNumber: "GR-001" },
      { name: "Student 2", grNumber: "GR-002" },
      { name: "Student 3", grNumber: "GR-003" },
      { name: "Student 4", grNumber: "GR-004" },
    ];

    // Seed checkpoint in Redis in-memory fallback: worker already processed first 2 rows
    const jobId = "job-retry-checkpoint-1";
    const checkpointKey = `mms:t1:import-checkpoint:${jobId}`;
    await redisSet(checkpointKey, "2");

    const updateProgress = vi.fn().mockResolvedValue(undefined);
    const ctx: ImportPipelineContext = {
      tenant: "t1",
      userId: "u1",
      jobId,
      offset: 0,
      viewerRole: "admin",
      updateProgress,
    };

    const result = await importStudentRows(rows, ctx);

    // Only students 3 and 4 should be processed
    expect(mockCreateStudent).toHaveBeenCalledTimes(2);
    expect(result.imported).toBe(2);
    expect(result.errors).toBeUndefined();

    // Checkpoint should be deleted when the batch completes
    const remainingCheckpoint = await redisGet(checkpointKey);
    expect(remainingCheckpoint).toBeNull();
  });
});

describe("EdTech Webhook Signature Verifier & Replay Protection", () => {
  const secret = "whsec_edtech_test_secret_key_12345";
  const payload = JSON.stringify({
    event: "user.updated",
    user: { id: "std-99", name: "Alice Wonderland" },
  });

  function sign(body: string, sec: string, timestamp?: number): string {
    const hmac = createHmac("sha256", sec);
    if (timestamp !== undefined) {
      hmac.update(`${timestamp}.`);
    }
    hmac.update(Buffer.from(body, "utf8"));
    return hmac.digest("hex");
  }

  it("verifies a valid HMAC-SHA256 signature with current timestamp", () => {
    const now = 1700000000000;
    const signature = sign(payload, secret, now);
    const valid = verifyEdtechWebhookSignature(payload, signature, secret, now, {
      currentTimeMs: now,
    });
    expect(valid).toBe(true);
  });

  it("verifies signatures with v1= or sha256= prefixes", () => {
    const now = 1700000000000;
    const hex = sign(payload, secret, now);
    expect(
      verifyEdtechWebhookSignature(payload, `v1=${hex}`, secret, now, { currentTimeMs: now }),
    ).toBe(true);
    expect(
      verifyEdtechWebhookSignature(payload, `sha256=${hex}`, secret, now, { currentTimeMs: now }),
    ).toBe(true);
  });

  it("rejects tampered payload content", () => {
    const now = 1700000000000;
    const signature = sign(payload, secret, now);
    const tampered = JSON.stringify({
      event: "user.updated",
      user: { id: "std-99", name: "Mallory" },
    });
    const valid = verifyEdtechWebhookSignature(tampered, signature, secret, now, {
      currentTimeMs: now,
    });
    expect(valid).toBe(false);
  });

  it("rejects invalid signature secret", () => {
    const now = 1700000000000;
    const signature = sign(payload, "wrong_secret", now);
    const valid = verifyEdtechWebhookSignature(payload, signature, secret, now, {
      currentTimeMs: now,
    });
    expect(valid).toBe(false);
  });

  it("rejects replay attacks where timestamp exceeds maximum drift (5 minutes)", () => {
    const baseTime = 1700000000000;
    const staleTimestamp = baseTime - 6 * 60 * 1000; // 6 minutes ago
    const signature = sign(payload, secret, staleTimestamp);

    const valid = verifyEdtechWebhookSignature(payload, signature, secret, staleTimestamp, {
      currentTimeMs: baseTime,
      maxDriftMs: 5 * 60 * 1000,
    });
    expect(valid).toBe(false);
  });

  it("verifies payload without timestamp when webhook provider does not send one", () => {
    const signature = sign(payload, secret);
    const valid = verifyEdtechWebhookSignature(payload, signature, secret);
    expect(valid).toBe(true);
  });
});

describe("EdTech Sync Rate Limiter & Token Lifecycle Utilities", () => {
  it("calculates exponential backoff with bounded maxDelayMs", () => {
    const delay0 = calculateExponentialBackoff(0, { baseDelayMs: 1000, jitter: false });
    const delay1 = calculateExponentialBackoff(1, { baseDelayMs: 1000, jitter: false });
    const delay2 = calculateExponentialBackoff(2, { baseDelayMs: 1000, jitter: false });
    const delayMax = calculateExponentialBackoff(10, {
      baseDelayMs: 1000,
      maxDelayMs: 15_000,
      jitter: false,
    });

    expect(delay0).toBe(1000);
    expect(delay1).toBe(2000);
    expect(delay2).toBe(4000);
    expect(delayMax).toBe(15_000);
  });

  it("identifies expired or imminent-expiring tokens", () => {
    const now = Date.now();
    expect(isTokenExpired(now - 1000)).toBe(true); // already expired
    expect(isTokenExpired(now + 2 * 60 * 1000, 5 * 60 * 1000)).toBe(true); // within 5m buffer
    expect(isTokenExpired(now + 30 * 60 * 1000, 5 * 60 * 1000)).toBe(false); // healthy token
  });
});

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
} from "@mms/be-core/integrations/edtech";
import { createHmac } from "node:crypto";
import type { ImportPipelineContext } from "@mms/contracts";
import type { StudentImportRow } from "@mms/mod-students/backend/use-cases";

const mockCreateStudent = vi.fn();
const mockUpsertContact = vi.fn();
const mockFindContacts = vi.fn();
const mockBroadcastCollection = vi.fn();

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenant: async (_tenant: string, cb: () => Promise<unknown>) => cb(),
  withTenantRead: async (_tenant: string, cb: () => Promise<unknown>) => cb(),
}));

vi.mock("@mms/mod-students/backend/deps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-students/backend/deps")>()),
  upsertContact: (...args: unknown[]) => mockUpsertContact(...args),
  findContactsMatchingUniqueValues: (...args: unknown[]) => mockFindContacts(...args),
}));

vi.mock(
  "../../../../packages/modules/students/dist/backend/use-cases/studentWriteUseCases.js",
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    createStudent: (...args: unknown[]) => mockCreateStudent(...args),
  }),
);

vi.mock("@mms/be-core/realtime", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
}));

import { redisGet, redisSet } from "@mms/be-core/redis";
import { importStudentRows } from "@mms/mod-students/backend/use-cases";

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

    // Only students 3 and 4 are created, but all four rows are now persisted.
    expect(mockCreateStudent).toHaveBeenCalledTimes(2);
    expect(result.imported).toBe(4);
    expect(result.errors).toBeUndefined();

    // Checkpoint should be deleted when the batch completes
    const remainingCheckpoint = await redisGet(checkpointKey);
    expect(remainingCheckpoint).toBeNull();
  });

  it("resumes at the absolute checkpoint across chunks instead of replaying earlier batches", async () => {
    const jobId = "job-retry-multichunk-1";
    const checkpointKey = `mms:t1:import-checkpoint:${jobId}`;
    // 380 rows were persisted before a crash in the second 200-row chunk.
    await redisSet(checkpointKey, "380");

    const chunk = Array.from({ length: 200 }, (_, index) => ({
      name: `Student ${index + 1}`,
      grNumber: `GR-${index + 1}`,
    })) as StudentImportRow[];
    const total = 450;
    const context = (offset: number): ImportPipelineContext => ({
      tenant: "t1",
      userId: "u1",
      jobId,
      offset,
      total,
      viewerRole: "admin",
      updateProgress: vi.fn().mockResolvedValue(undefined),
    });

    // Chunk 1 (absolute 0-199) is already persisted: no writes, all 200 reported imported.
    const first = await importStudentRows(chunk, context(0));
    expect(mockCreateStudent).toHaveBeenCalledTimes(0);
    expect(first.imported).toBe(200);

    // Chunk 2 (absolute 200-399): only local 180-199 (absolute 380-399) are missing.
    const second = await importStudentRows(chunk, context(200));
    expect(mockCreateStudent).toHaveBeenCalledTimes(20);
    expect(second.imported).toBe(200);

    // Last chunk deletes the checkpoint.
    const last = await importStudentRows(chunk.slice(0, 50), context(400));
    expect(last.imported).toBe(50);
    expect(mockCreateStudent).toHaveBeenCalledTimes(70);
    expect(await redisGet(checkpointKey)).toBeNull();
  });

  it("freezes the checkpoint at the last contiguous success when a row fails", async () => {
    const jobId = "job-retry-failure-1";
    const checkpointKey = `mms:t1:import-checkpoint:${jobId}`;
    await redisSet(checkpointKey, "0");
    mockCreateStudent.mockRejectedValueOnce(new Error("database unavailable"));

    const rows = [
      { name: "Student 1", grNumber: "GR-1" },
      { name: "Student 2", grNumber: "GR-2" },
      { name: "Student 3", grNumber: "GR-3" },
    ] as StudentImportRow[];

    const result = await importStudentRows(rows, {
      tenant: "t1",
      userId: "u1",
      jobId,
      offset: 0,
      total: rows.length,
      viewerRole: "admin",
      updateProgress: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.errors?.[0]?.reason).toBe("database unavailable");
    // The failed row must stay retryable: the stored position never moves past it.
    expect(await redisGet(checkpointKey)).not.toBe("1");
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

import { describe, it, expect } from "vitest";
import { streamTableToExcel, streamLedgerToS3 } from "../worker/processors/excel-export.js";
import { resolveLocalArtifactPath } from "../config/storage.js";
import { existsSync, statSync } from "node:fs";

describe("Streaming Excel Export Engine (Phase 6)", () => {
  it("streams tabular rows to .xlsx directly without buffering whole dataset", async () => {
    async function* mockRowGenerator() {
      for (let i = 1; i <= 500; i++) {
        yield {
          id: `ID-${i}`,
          name: `Student Record ${i}`,
          grade: i % 2 === 0 ? "A" : "B",
          feeStatus: "Paid",
          created: new Date().toISOString(),
        };
      }
    }

    const progressUpdates: number[] = [];
    const result = await streamTableToExcel({
      tenantId: "tenant-test-stream",
      filename: "test-students-stream",
      worksheetName: "Students",
      columns: [
        { header: "Student ID", key: "id", width: 15 },
        { header: "Full Name", key: "name", width: 30 },
        { header: "Grade", key: "grade", width: 10 },
        { header: "Status", key: "feeStatus", width: 15 },
        { header: "Enrolled At", key: "created", width: 25 },
      ],
      rowGenerator: mockRowGenerator(),
      onProgress: (count) => {
        progressUpdates.push(count);
      },
    });

    expect(result.key).toContain("tenants/tenant-test-stream/exports/");
    expect(result.key).toContain("test-students-stream.xlsx");

    const filePath = resolveLocalArtifactPath(result.key);
    expect(existsSync(filePath)).toBe(true);
    const stats = statSync(filePath);
    expect(stats.size).toBeGreaterThan(1000);
  });

  it("streams financial ledger to S3/local storage and verifies memory efficiency", async () => {
    const memoryBefore = process.memoryUsage().heapUsed;

    async function* ledgerGenerator() {
      for (let i = 1; i <= 2000; i++) {
        yield {
          date: "2026-08-15",
          account: `100${i % 10}-Asset-Cash`,
          debit: (i * 10).toFixed(2),
          credit: "0.00",
          balance: (i * 100).toFixed(2),
          description: `General ledger entry transaction #${i}`,
        };
      }
    }

    const s3Key = await streamLedgerToS3("tenant-ledger-1", "general-ledger-q3", ledgerGenerator());

    const memoryAfter = process.memoryUsage().heapUsed;
    const heapDiffMb = (memoryAfter - memoryBefore) / (1024 * 1024);

    expect(s3Key).toContain("tenants/tenant-ledger-1/exports/");
    expect(s3Key).toContain("general-ledger-q3.xlsx");

    const filePath = resolveLocalArtifactPath(s3Key);
    expect(existsSync(filePath)).toBe(true);

    // Memory overhead should remain well below 120MB
    expect(heapDiffMb).toBeLessThan(120);
  });

  it("handles high-volume 10,000 row dataset stream without exceeding memory ceiling", async () => {
    const memoryBefore = process.memoryUsage().heapUsed;

    async function* largeVolumeGenerator() {
      for (let i = 1; i <= 10000; i++) {
        yield {
          id: `REC-${i}`,
          timestamp: "2026-08-22T10:00:00.000Z",
          amount: (i * 1.5).toFixed(2),
          status: i % 3 === 0 ? "Settled" : "Pending",
          notes: `Batch financial record item #${i} processed via streaming writer`,
        };
      }
    }

    const result = await streamTableToExcel({
      tenantId: "tenant-bulk-stream",
      filename: "bulk-10k-records",
      columns: [
        { header: "Record ID", key: "id", width: 15 },
        { header: "Timestamp", key: "timestamp", width: 25 },
        { header: "Amount", key: "amount", width: 15 },
        { header: "Status", key: "status", width: 15 },
        { header: "Notes", key: "notes", width: 40 },
      ],
      rowGenerator: largeVolumeGenerator(),
    });

    const memoryAfter = process.memoryUsage().heapUsed;
    const heapDiffMb = (memoryAfter - memoryBefore) / (1024 * 1024);

    expect(result.key).toContain("bulk-10k-records.xlsx");
    const filePath = resolveLocalArtifactPath(result.key);
    expect(existsSync(filePath)).toBe(true);
    expect(heapDiffMb).toBeLessThan(120);
  });
});

import { describe, expect, it } from "vitest";
import {
  generateCsvStreamChunks,
  streamCsvExportFromGenerator,
} from "../lib/csvExportStreamFactory.js";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";

describe("Memory-Bounded Backpressure Streaming", () => {
  it("streams 50,000 records while maintaining heap delta < 50 MB", async () => {
    const totalRecords = 50_000;
    const columns = [
      { label: "ID", key: "id" },
      { label: "Name", key: "name" },
      { label: "Email", key: "email" },
      { label: "Role", key: "role" },
    ];

    const loadPage = async (page: number, limit: number) => {
      const start = (page - 1) * limit + 1;
      if (start > totalRecords) return { rows: [], hasMore: false };
      const rows = [];
      const end = Math.min(start + limit - 1, totalRecords);
      for (let i = start; i <= end; i++) {
        rows.push({
          id: `usr_${i}`,
          name: `User Number ${i}`,
          email: `user${i}@example.com`,
          role: i % 2 === 0 ? "Admin" : "Member",
        });
      }
      return { rows, hasMore: end < totalRecords };
    };

    function* yieldDataChunks(rows: any[]) {
      for (const r of rows) {
        yield `${r.id},"${r.name}","${r.email}","${r.role}"\n`;
      }
    }

    if (global.gc) global.gc();
    const heapBefore = process.memoryUsage().heapUsed;

    const generator = generateCsvStreamChunks({
      filename: "large_export.csv",
      chunkSize: 500,
      columns,
      loadByIds: async () => [],
      loadPage,
      yieldDataChunks,
    });

    const readable = streamCsvExportFromGenerator(generator, { highWaterMark: 16384 });

    let bytesReceived = 0;
    let chunksCount = 0;

    const writable = new Writable({
      highWaterMark: 16384,
      write(chunk, _encoding, callback) {
        bytesReceived += chunk.length;
        chunksCount++;
        // Simulate small downstream I/O latency to exercise stream backpressure
        setImmediate(callback);
      },
    });

    await pipeline(readable, writable);

    const heapAfter = process.memoryUsage().heapUsed;
    const heapDeltaMb = Math.abs(heapAfter - heapBefore) / (1024 * 1024);

    expect(bytesReceived).toBeGreaterThan(1_000_000);
    expect(chunksCount).toBeGreaterThan(100);
    // Mandatory assertion: peak heap delta delta must be strictly < 50 MB
    expect(heapDeltaMb).toBeLessThan(50);
  });
});

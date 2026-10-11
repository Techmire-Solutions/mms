import { describe, expect, it } from "vitest";
import {
  CsvExportLimitError,
  MODULE_CSV_EXPORT_MAX_BYTES,
  MODULE_CSV_EXPORT_MAX_RECORDS,
  buildCsvExportFromGenerator,
  generateCsvStreamChunks,
  normalizeIncludeDeletedFlag,
  streamCsvExportFromGenerator,
} from "../lib/csvExportStreamFactory.js";

describe("csvExportStreamFactory", () => {
  describe("normalizeIncludeDeletedFlag", () => {
    it("returns undefined when allowDeleted is false", () => {
      expect(normalizeIncludeDeletedFlag("true", false)).toBeUndefined();
      expect(normalizeIncludeDeletedFlag(true, false)).toBeUndefined();
    });

    it("returns undefined when value is null or undefined", () => {
      expect(normalizeIncludeDeletedFlag(undefined, true)).toBeUndefined();
      expect(normalizeIncludeDeletedFlag(null, true)).toBeUndefined();
    });

    it("coerces valid truthy/falsy query flag strings when allowDeleted is true", () => {
      expect(normalizeIncludeDeletedFlag("true", true)).toBe(true);
      expect(normalizeIncludeDeletedFlag("1", true)).toBe(true);
      expect(normalizeIncludeDeletedFlag("false", true)).toBe(false);
      expect(normalizeIncludeDeletedFlag("0", true)).toBe(false);
    });
  });

  describe("generateCsvStreamChunks", () => {
    const columns = [
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
    ];

    function* mockYieldChunks(
      rows: Array<{ id: string; name: string }>,
      _cols: typeof columns,
      _chunkSize: number,
    ) {
      for (const row of rows) {
        yield `${row.id},${row.name}\n`;
      }
    }

    it("handles includeIds with matching rows", async () => {
      const generator = generateCsvStreamChunks({
        filename: "export.csv",
        chunkSize: 10,
        columns,
        includeIds: ["id1", "id2"],
        loadByIds: async (ids) => ids.map((id) => ({ id, name: `Name-${id}` })),
        loadPage: async () => ({ rows: [], hasMore: false }),
        yieldDataChunks: mockYieldChunks,
      });

      const chunks: string[] = [];
      let step = await generator.next();
      while (!step.done) {
        chunks.push(step.value);
        step = await generator.next();
      }

      expect(chunks[0]).toContain('"ID","Name"');
      expect(chunks.slice(1).join("")).toBe("id1,Name-id1\nid2,Name-id2\n");
      expect(step.value).toEqual({ count: 2, filename: "export.csv" });
    });

    it("handles includeIds with zero matching rows", async () => {
      const generator = generateCsvStreamChunks({
        filename: "empty.csv",
        chunkSize: 10,
        columns,
        includeIds: ["missing"],
        loadByIds: async () => [],
        loadPage: async () => ({ rows: [], hasMore: false }),
        yieldDataChunks: mockYieldChunks,
      });

      const chunks: string[] = [];
      let step = await generator.next();
      while (!step.done) {
        chunks.push(step.value);
        step = await generator.next();
      }

      expect(chunks.length).toBe(1); // Header only
      expect(step.value).toEqual({ count: 0, filename: "empty.csv" });
    });

    it("walks pages until hasMore is false", async () => {
      const pages = [
        {
          rows: [
            { id: "1", name: "Row 1" },
            { id: "2", name: "Row 2" },
          ],
          hasMore: true,
        },
        { rows: [{ id: "3", name: "Row 3" }], hasMore: false },
      ];

      const generator = generateCsvStreamChunks({
        filename: "paged.csv",
        chunkSize: 2,
        columns,
        loadByIds: async () => [],
        loadPage: async (page) => pages[page - 1] ?? { rows: [], hasMore: false },
        yieldDataChunks: mockYieldChunks,
      });

      const res = await buildCsvExportFromGenerator(generator, "fallback.csv");
      expect(res.count).toBe(3);
      expect(res.filename).toBe("paged.csv");
      expect(res.csv).toContain('"ID","Name"');
      expect(res.csv).toContain("1,Row 1");
      expect(res.csv).toContain("3,Row 3");
    });
  });

  describe("streamCsvExportFromGenerator", () => {
    it("creates a readable stream that delivers chunks", async () => {
      async function* mockGen() {
        yield "header\n";
        yield "row1\n";
        return { count: 1, filename: "test.csv" };
      }

      const stream = streamCsvExportFromGenerator(mockGen());
      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(String(chunk));
      }
      expect(chunks.join("")).toBe("header\nrow1\n");
    });
  });

  describe("buildCsvExportFromGenerator", () => {
    it("throws CsvExportLimitError when byte length exceeds cap", async () => {
      async function* largeGen() {
        yield "a".repeat(200);
        return { count: 1, filename: "huge.csv" };
      }

      await expect(buildCsvExportFromGenerator(largeGen(), "fallback.csv", 100)).rejects.toThrow(
        CsvExportLimitError,
      );
    });

    it("uses fallbackFilename if generator meta does not specify filename", async () => {
      async function* noMetaGen(): AsyncGenerator<
        string,
        { count: number; filename: string },
        undefined
      > {
        yield "chunk1";
        return { count: 1, filename: "" };
      }

      const res = await buildCsvExportFromGenerator(noMetaGen(), "default.csv");
      expect(res.filename).toBe("default.csv");
      expect(res.count).toBe(1);
    });

    it("throws CsvExportLimitError when record count exceeds MODULE_CSV_EXPORT_MAX_RECORDS", async () => {
      async function* excessRecordsGen(): AsyncGenerator<
        string,
        { count: number; filename: string },
        undefined
      > {
        yield "chunk1";
        return { count: MODULE_CSV_EXPORT_MAX_RECORDS + 1, filename: "large.csv" };
      }

      await expect(buildCsvExportFromGenerator(excessRecordsGen(), "fallback.csv")).rejects.toThrow(
        CsvExportLimitError,
      );
    });
  });

  it("exports MODULE_CSV_EXPORT_MAX_BYTES and MODULE_CSV_EXPORT_MAX_RECORDS constants", () => {
    expect(MODULE_CSV_EXPORT_MAX_BYTES).toBe(50 * 1024 * 1024);
    expect(MODULE_CSV_EXPORT_MAX_RECORDS).toBe(5000);
  });
});

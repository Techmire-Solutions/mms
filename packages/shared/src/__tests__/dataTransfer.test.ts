import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  validateImportRows,
  runImportPipeline,
  buildExportGrid,
  yieldExportGridChunks,
  filterExportColumnsByVisibility,
  csvSerializer,
  jsonSerializer,
  getSerializer,
} from "../dataTransfer/index.js";

describe("validateImportRows", () => {
  const schema = z.object({
    id: z.string(),
    score: z.number(),
  });

  it("validates rows and collects per-row errors with 1-based indexing", () => {
    const raw = [
      { id: "a", score: 10 },
      { id: "b", score: "not-a-number" },
      { id: "c", score: 20 },
    ];
    const { valid, errors } = validateImportRows(raw, schema);
    expect(valid).toHaveLength(2);
    expect(valid[0]).toEqual({ id: "a", score: 10 });
    expect(valid[1]).toEqual({ id: "c", score: 20 });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.row).toBe(2);
    expect(errors[0]?.reason).toContain("score");
  });

  it("sanitizes Unicode BiDi override characters before validation", () => {
    const textWithBidi = "test\u202Ereversed";
    const row = [{ id: textWithBidi, score: 5 }];
    const { valid } = validateImportRows(row, schema);
    expect(valid[0]?.id).not.toContain("\u202E");
  });
});

describe("runImportPipeline", () => {
  const schema = z.object({ code: z.string() });

  it("coordinates validate, transform, chunking, and progress updates", async () => {
    const raw = [{ code: "alpha" }, { code: "beta" }, { code: "bad-syntax" }];
    const updateProgress = vi.fn();
    const ctx = {
      tenant: "demo",
      userId: "u1",
      jobId: "j1",
      viewerRole: "admin",
      updateProgress,
    };

    const result = await runImportPipeline(
      raw,
      {
        rowSchema: schema,
        maxBatch: 1,
        transform: (row) => {
          if (row.code === "bad-syntax") throw new Error("Rejected syntax");
          return { code: row.code.toUpperCase() };
        },
      },
      async (chunk) => ({ imported: chunk.length }),
      ctx,
    );

    expect(result.total).toBe(3);
    expect(result.imported).toBe(2);
    expect(result.failed).toBe(1);
    expect(updateProgress).toHaveBeenCalled();
  });
});

describe("buildExportGrid & serializers", () => {
  const columns = [
    { id: "name", label: "Name" },
    { id: "role", label: "Role" },
  ];
  const rows = [
    { name: "Alice", role: "Teacher" },
    { name: "Bob", role: null },
  ];
  const extractor = (row: (typeof rows)[0], colId: string) =>
    colId === "name" ? row.name : row.role;

  it("builds a 2D grid with header row", () => {
    const grid = buildExportGrid(rows, columns, extractor);
    expect(grid).toEqual([
      ["Name", "Role"],
      ["Alice", "Teacher"],
      ["Bob", ""],
    ]);
  });

  it("yields chunks via generator", () => {
    const chunks = Array.from(yieldExportGridChunks(rows, columns, extractor, 1));
    expect(chunks).toHaveLength(3); // header chunk + 2 single-row chunks
    expect(chunks[0]).toEqual([["Name", "Role"]]);
  });

  it("serializes CSV and escapes values safely", () => {
    const grid = [
      ["Title", "Formula"],
      ["Item 1", "=SUM(A1:A2)"],
    ];
    const csv = csvSerializer.serialize(grid);
    expect(csv).toContain('"Title","Formula"');
    expect(csv).toContain("'=SUM(A1:A2)"); // Prepended single quote prevents injection
  });

  it("serializes JSON to array of record objects", () => {
    const grid = [
      ["Name", "Role"],
      ["Alice", "Teacher"],
    ];
    const jsonStr = jsonSerializer.serialize(grid);
    expect(JSON.parse(jsonStr)).toEqual([{ Name: "Alice", Role: "Teacher" }]);
  });

  it("retrieves serializers from registry", () => {
    expect(getSerializer("csv")).toBe(csvSerializer);
    expect(getSerializer("json")).toBe(jsonSerializer);
  });
});

describe("filterExportColumnsByVisibility", () => {
  const columns = [
    { id: "id", label: "ID" },
    { id: "phone", label: "Phone" },
    { id: "notes", label: "Notes" },
  ];

  it("always retains columns in alwaysVisible set", () => {
    const filtered = filterExportColumnsByVisibility(columns, {
      fieldsByTab: {},
      formTabs: [],
      viewerRole: "teacher",
      alwaysVisible: new Set(["id"]),
    });
    expect(filtered.map((c) => c.id)).toContain("id");
  });
});

import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { createModuleExportService } from "../lib/createModuleExportService.js";
import { createModuleImportService } from "../lib/createModuleImportService.js";

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "test-tenant",
}));

type SampleEntity = {
  id: string;
  name: string;
  email: string;
  active: boolean;
};

const sampleRows: SampleEntity[] = [
  { id: "1", name: "Alice Smith", email: "alice@example.com", active: true },
  { id: "2", name: "Bob Jones", email: "bob@example.com", active: false },
];

describe("createModuleExportService multi-format export", () => {
  const exportService = createModuleExportService<
    SampleEntity,
    { search?: string },
    { id: string; label: string }
  >({
    manifest: {
      defaultExportFilename: "sample_export",
      exportChunkSize: 100,
    },
    normalizeQuery: (query) => query,
    prepareExport: () => ({
      columns: [
        { id: "name", label: "Full Name" },
        { id: "email", label: "Email Address" },
        { id: "active", label: "Is Active" },
      ],
      context: undefined,
    }),
    loadByIds: async (ids) => sampleRows.filter((r) => ids.includes(r.id)),
    loadPage: async (_q, page) => ({
      rows: page === 1 ? sampleRows : [],
      hasMore: false,
    }),
    yieldDataChunks: function* (rows, _cols, _size) {
      for (const row of rows) {
        yield `"${row.name}","${row.email}","${row.active}"\n`;
      }
    },
    extractCell: (row, columnId) => {
      if (columnId === "name") return row.name;
      if (columnId === "email") return row.email;
      if (columnId === "active") return row.active ? "Yes" : "No";
      return "";
    },
  });

  it("exports CSV format by default", async () => {
    const result = await exportService.buildExport({}, { viewerRole: "admin", format: "csv" });
    expect(result.format).toBe("csv");
    expect(result.contentType).toContain("text/csv");
    expect(result.filename).toBe("test-tenant_sample_export.csv");
    expect(result.content).toContain("Full Name");
    expect(result.content).toContain("Alice Smith");
  });

  it("exports JSON format correctly", async () => {
    const result = await exportService.buildExport({}, { viewerRole: "admin", format: "json" });
    expect(result.format).toBe("json");
    expect(result.contentType).toContain("application/json");
    expect(result.filename).toBe("test-tenant_sample_export.json");
    const parsed = JSON.parse(result.content);
    expect(parsed).toEqual([
      { "Full Name": "Alice Smith", "Email Address": "alice@example.com", "Is Active": "Yes" },
      { "Full Name": "Bob Jones", "Email Address": "bob@example.com", "Is Active": "No" },
    ]);
  });

  it("exports XLSX format as Base64 encoded Excel document", async () => {
    const result = await exportService.buildExport({}, { viewerRole: "admin", format: "xlsx" });
    expect(result.format).toBe("xlsx");
    expect(result.filename).toBe("test-tenant_sample_export.xlsx");
    expect(result.content.length).toBeGreaterThan(50);
    const buf = Buffer.from(result.content, "base64");
    expect(buf.slice(0, 2).toString()).toBe("PK"); // Zip archive signature for xlsx
  });

  it("enforces MAX_MATERIALIZED_EXPORT_ROWS (10,000) ceiling on materialized formats to prevent worker OOM", async () => {
    const largeIds = Array.from({ length: 10_001 }, (_, i) => String(i));
    await expect(
      exportService.buildExport({ includeIds: largeIds } as never, {
        viewerRole: "admin",
        format: "xlsx",
      }),
    ).rejects.toThrow(/exceeds 10,000 rows/);
  });
});

describe("createModuleExportService OFFSET continuation", () => {
  type OffsetRow = { id: string; name: string };

  // Caller-sorted by name while ids are deliberately non-monotonic: advancing
  // the cursor from the last row's id would switch later pages to `ORDER BY id`
  // and drop rows.
  const offsetPages: OffsetRow[][] = [
    [
      { id: "b", name: "Bilal" },
      { id: "a", name: "Aisha" },
    ],
    [
      { id: "d", name: "Daud" },
      { id: "c", name: "Chand" },
    ],
    [{ id: "f", name: "Faiz" }],
  ];

  function createOffsetService(
    loadPage: (
      page: number,
      afterId?: string,
    ) => Promise<{ rows: OffsetRow[]; hasMore: boolean; nextCursor?: string }>,
  ) {
    return createModuleExportService<
      OffsetRow,
      Record<string, never>,
      { id: string; label: string }
    >({
      manifest: { defaultExportFilename: "offset_export", exportChunkSize: 2 },
      normalizeQuery: (query) => query,
      prepareExport: () => ({ columns: [{ id: "name", label: "Name" }], context: undefined }),
      loadByIds: async () => [],
      loadPage: (_query, page, _limit, afterId) => loadPage(page, afterId),
      yieldDataChunks: function* (rows) {
        for (const row of rows) yield `${row.name}\n`;
      },
      extractCell: (row) => row.name,
    });
  }

  it("keeps OFFSET paging when the pager emits no nextCursor", async () => {
    const loadPage = vi.fn(async (page: number, afterId?: string) => {
      void afterId;
      return { rows: offsetPages[page - 1] ?? [], hasMore: page < offsetPages.length };
    });
    const service = createOffsetService(loadPage);

    const result = await service.buildExport({}, { viewerRole: "admin", format: "json" });

    expect(loadPage.mock.calls.map(([page]) => page)).toEqual([1, 2, 3]);
    expect(loadPage.mock.calls.every(([, afterId]) => afterId === undefined)).toBe(true);
    expect(result.count).toBe(5);
    expect(JSON.parse(result.content)).toEqual([
      { Name: "Bilal" },
      { Name: "Aisha" },
      { Name: "Daud" },
      { Name: "Chand" },
      { Name: "Faiz" },
    ]);
  });

  it("throws instead of looping when hasMore is true with zero rows", async () => {
    const service = createOffsetService(async () => ({ rows: [], hasMore: true }));

    await expect(service.buildExport({}, { viewerRole: "admin", format: "json" })).rejects.toThrow(
      /hasMore=true with zero rows/,
    );
  });
});

describe("createModuleImportService", () => {
  const rowSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
  });

  const importService = createModuleImportService({
    moduleId: "test-import",
    entityNounPlural: "test records",
    spec: {
      rowSchema,
      maxBatch: 10,
    },
    persist: async (rows) => ({ imported: rows.length }),
  });

  it("runs import validation and accumulates errors", async () => {
    const mockCtx = {
      tenant: "demo",
      userId: "u1",
      jobId: "j1",
      viewerRole: "admin",
      updateProgress: vi.fn(),
    };

    const rawRows = [
      { name: "Valid User", email: "valid@example.com" },
      { name: "X", email: "invalid-email" }, // Fails schema
    ];

    const result = await importService.runImport(rawRows, mockCtx);
    expect(result.total).toBe(2);
    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]?.row).toBe(2);
  });
});

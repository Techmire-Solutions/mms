import { describe, expect, it, vi, beforeEach } from "vitest";
import { listStudentsPage } from "../db/repositories/studentRepositoryListPage.js";
import { generateCsvStreamChunks } from "../lib/csvExportStreamFactory.js";

const mocks = vi.hoisted(() => ({
  hydrate: vi.fn(async (_tx: unknown, _tenant: string, rows: unknown[]) => rows),
  enableIncludeDeleted: vi.fn(async (_tx: unknown) => undefined),
  selectResults: [] as unknown[][],
  captured: [] as Array<Record<string, unknown>>,
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenantRead: async (_tenant: string, work: (tx: unknown) => Promise<unknown>) =>
    work(createFakeTx()),
}));

vi.mock("../lib/softDeleteHelpers.js", () => ({
  enableIncludeDeleted: (tx: unknown) => mocks.enableIncludeDeleted(tx),
}));

vi.mock("../db/repositories/studentRepository.js", () => ({
  hydrateStudentsList: (tx: unknown, tenant: string, rows: unknown[]) =>
    mocks.hydrate(tx, tenant, rows),
}));

type QueryChunk = string | { value?: unknown };

/** Renders the Drizzle `sql` object used for ORDER BY so tests can assert the clause. */
function renderSql(query: unknown): string {
  const chunks = (query as { queryChunks?: QueryChunk[] })?.queryChunks ?? [];
  return chunks
    .map((chunk) => {
      if (typeof chunk === "string") return chunk;
      if (chunk instanceof String) return String(chunk);
      const value = chunk && typeof chunk === "object" ? chunk.value : undefined;
      if (Array.isArray(value)) return value.join("");
      const name = (chunk as { name?: string })?.name;
      return name ? `"${name}"` : "?";
    })
    .join("");
}

function createBuilder(result: unknown[]) {
  const capture: Record<string, unknown> = {};
  mocks.captured.push(capture);
  const builder: Record<string, unknown> = {
    from: () => builder,
    leftJoin: () => builder,
    where: () => builder,
    orderBy: (clause: unknown) => {
      capture.orderBy = renderSql(clause);
      return builder;
    },
    limit: (value: number) => {
      capture.limit = value;
      return builder;
    },
    offset: (value: number) => {
      capture.offset = value;
      return builder;
    },
    then: (resolve: (value: unknown[]) => void) => resolve(result),
  };
  return builder;
}

function createFakeTx() {
  return {
    select: () => createBuilder(mocks.selectResults.shift() ?? []),
  };
}

describe("listStudentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectResults = [];
    mocks.captured = [];
  });

  it("pages with offset/limit and derives hasMore from the count", async () => {
    mocks.selectResults = [[{ count: 120 }], [{ id: "s-1" }, { id: "s-2" }]];

    const page = await listStudentsPage("demo", { page: 2, limit: 25 });

    expect(page.page).toBe(2);
    expect(page.limit).toBe(25);
    expect(page.total).toBe(120);
    expect(page.hasMore).toBe(true);
    expect(mocks.captured[1]?.offset).toBe(25);
    expect(mocks.captured[1]?.limit).toBe(25);
    expect(mocks.captured[1]?.orderBy).toEqual(expect.any(String));
  });

  it("skips the count query when skipCount is set", async () => {
    mocks.selectResults = [[{ id: "s-1" }]];

    const page = await listStudentsPage("demo", { page: 1, limit: 10, skipCount: true });

    expect(page.total).toBe(0);
    expect(mocks.captured).toHaveLength(1);
  });

  it("derives hasMore from a full page when skipCount suppresses the count", async () => {
    // C1: the export pager walks with skipCount and no cursor, so `total` is 0 and a
    // count-relative hasMore is always false — the export stopped after one page.
    mocks.selectResults = [[{ id: "s-1" }, { id: "s-2" }]];
    const full = await listStudentsPage("demo", { page: 1, limit: 2, skipCount: true });
    expect(full.total).toBe(0);
    expect(full.hasMore).toBe(true);

    mocks.selectResults = [[{ id: "s-5" }]];
    const last = await listStudentsPage("demo", { page: 3, limit: 2, skipCount: true });
    expect(last.hasMore).toBe(false);
  });

  it("exports every page of a count-free walk", async () => {
    // C1 regression: mirrors listPageExportRegression for modules that use runListPage.
    mocks.selectResults = [
      [{ id: "s-1" }, { id: "s-2" }],
      [{ id: "s-3" }, { id: "s-4" }],
      [{ id: "s-5" }],
    ];

    const chunks = generateCsvStreamChunks({
      filename: "students.csv",
      chunkSize: 2,
      columns: [{ label: "ID" }],
      loadByIds: async () => [],
      loadPage: async (page, limit) => {
        const result = await listStudentsPage("demo", { page, limit, skipCount: true });
        return {
          rows: result.students as Array<{ id: string }>,
          hasMore: result.hasMore,
        };
      },
      yieldDataChunks: function* (rows) {
        for (const row of rows) yield `\n${row.id}`;
      },
    });

    let csv = "";
    for await (const chunk of chunks) csv += chunk;

    expect(csv.split("\n").slice(1)).toEqual(["s-1", "s-2", "s-3", "s-4", "s-5"]);
  });

  it("uses an id-only order and no offset for keyset paging, emitting a cursor", async () => {
    mocks.selectResults = [[{ count: 0 }], [{ id: "s-1" }, { id: "s-2" }]];

    const page = await listStudentsPage("demo", { page: 3, limit: 2, afterId: "s-0" });

    expect(mocks.captured[1]?.offset).toBe(0);
    // D-19: keyset paging is id-ordered by contract — a bare-id cursor cannot honour another sort.
    expect(mocks.captured[1]?.orderBy).toContain("id");
    expect(mocks.captured[1]?.orderBy).not.toContain("name");
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe("s-2");
  });

  it("keeps the id order when a sort field is also requested with a cursor", async () => {
    mocks.selectResults = [[{ count: 0 }], [{ id: "s-1" }]];

    await listStudentsPage("demo", {
      page: 1,
      limit: 5,
      afterId: "s-0",
      sortField: "name",
      sortDir: "asc",
    });

    expect(mocks.captured[1]?.orderBy).toContain("id");
  });

  it("opts into soft-deleted rows for trash paging", async () => {
    mocks.selectResults = [[{ count: 0 }], []];
    await listStudentsPage("demo", { page: 1, limit: 10, includeDeleted: true });
    expect(mocks.enableIncludeDeleted).toHaveBeenCalledTimes(1);

    mocks.enableIncludeDeleted.mockClear();
    mocks.selectResults = [[{ count: 0 }], []];
    await listStudentsPage("demo", { page: 1, limit: 10 });
    expect(mocks.enableIncludeDeleted).not.toHaveBeenCalled();
  });

  it("hydrates the page rows before returning them", async () => {
    mocks.selectResults = [[{ count: 1 }], [{ id: "s-1" }]];
    mocks.hydrate.mockResolvedValueOnce([{ id: "s-1", name: "Hydrated" }]);

    const page = await listStudentsPage("demo", { page: 1, limit: 10 });

    expect(page.students).toEqual([{ id: "s-1", name: "Hydrated" }]);
    expect(mocks.hydrate).toHaveBeenCalledWith(expect.anything(), "demo", [{ id: "s-1" }]);
  });

  it("joins contacts only when the query needs contact-derived filters", async () => {
    mocks.selectResults = [[{ count: 0 }], []];
    await listStudentsPage("demo", { page: 1, limit: 10, search: "ali" });
    expect(mocks.captured.length).toBe(2);

    mocks.captured = [];
    mocks.selectResults = [[{ count: 0 }], []];
    await listStudentsPage("demo", { page: 1, limit: 10 });
    expect(mocks.captured.length).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import type { DataTableColumn, DataTableFilter } from "./dataTableTypes";
import {
  buildDataTableRegistry,
  countActiveFilters,
  filterDataTableRows,
  resolveVisibleColumns,
  sortDataTableRows,
} from "./dataTableUtils";

interface Row {
  id: string;
  name: string;
  code: string;
  tags: string[];
  active: boolean;
}

const rows: Row[] = [
  { id: "1", name: "Head Teacher", code: "HT", tags: ["admin"], active: true },
  { id: "2", name: "Assistant", code: "AS", tags: ["teacher", "admin"], active: false },
  { id: "3", name: "Librarian", code: "LB", tags: [], active: true },
];

const columns: DataTableColumn<Row>[] = [
  { id: "name", label: "Name", render: (r) => r.name, fixed: true },
  { id: "code", label: "Code", render: (r) => r.code },
  { id: "tags", label: "Tags", render: (r) => r.tags.join(", "), defaultHidden: true },
  {
    id: "status",
    label: "Status",
    render: (r) => String(r.active),
    searchValue: (r) => (r.active ? "active" : "inactive"),
  },
];

const statusFilter: DataTableFilter<Row> = {
  id: "status",
  label: "Status",
  options: [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ],
  getValue: (r) => (r.active ? "active" : "inactive"),
};
const tagFilter: DataTableFilter<Row> = {
  id: "tags",
  label: "Tags",
  options: [{ value: "admin", label: "Admin" }],
  getValue: (r) => r.tags,
};

describe("buildDataTableRegistry / resolveVisibleColumns", () => {
  it("honours defaultHidden, fixed, and user order", () => {
    const registry = buildDataTableRegistry(columns);
    expect(registry.map((e) => [e.key, e.enabled])).toEqual([
      ["name", true],
      ["code", true],
      ["tags", false],
      ["status", true],
    ]);
    const reordered = registry.map((e) => (e.key === "status" ? { ...e, order: -1 } : e));
    expect(resolveVisibleColumns(columns, reordered).map((c) => c.id)).toEqual([
      "status",
      "name",
      "code",
    ]);
  });
});

describe("filterDataTableRows", () => {
  const visible = resolveVisibleColumns(columns, buildDataTableRegistry(columns));

  it("searches only visible columns, case-insensitively, all terms", () => {
    expect(filterDataTableRows(rows, visible, "ht", [], {}).map((r) => r.id)).toEqual(["1"]);
    expect(filterDataTableRows(rows, visible, "INACTIVE", [], {}).map((r) => r.id)).toEqual(["2"]);
    expect(filterDataTableRows(rows, visible, "teacher", [], {}).map((r) => r.id)).toEqual(["1"]);
    expect(filterDataTableRows(rows, visible, "head ht", [], {}).map((r) => r.id)).toEqual(["1"]);
  });

  it("includes hidden columns once made visible", () => {
    const all = columns;
    expect(filterDataTableRows(rows, all, "teacher", [], {}).map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("applies facet filters with OR within a facet and AND across facets", () => {
    const filters = [statusFilter, tagFilter];
    expect(
      filterDataTableRows(rows, visible, "", filters, { status: ["active"] }).map((r) => r.id),
    ).toEqual(["1", "3"]);
    expect(
      filterDataTableRows(rows, visible, "", filters, {
        status: ["active", "inactive"],
        tags: ["admin"],
      }).map((r) => r.id),
    ).toEqual(["1", "2"]);
    expect(countActiveFilters({ status: ["active", "inactive"], tags: ["admin"] })).toBe(3);
  });

  it("supports wildcard search using * and ?", () => {
    expect(filterDataTableRows(rows, visible, "Libr*", [], {}).map((r) => r.id)).toEqual(["3"]);
    expect(filterDataTableRows(rows, visible, "*cher", [], {}).map((r) => r.id)).toEqual(["1"]);
    expect(filterDataTableRows(rows, visible, "H?", [], {}).map((r) => r.id)).toEqual(["1"]);
    expect(filterDataTableRows(rows, visible, "?B", [], {}).map((r) => r.id)).toEqual(["3"]);
  });
});

describe("sortDataTableRows", () => {
  const visible = resolveVisibleColumns(columns, buildDataTableRegistry(columns));

  it("sorts rows ascending and descending by column key", () => {
    const asc = sortDataTableRows(rows, visible, "name", "asc");
    expect(asc.map((r) => r.name)).toEqual(["Assistant", "Head Teacher", "Librarian"]);

    const desc = sortDataTableRows(rows, visible, "name", "desc");
    expect(desc.map((r) => r.name)).toEqual(["Librarian", "Head Teacher", "Assistant"]);
  });
});

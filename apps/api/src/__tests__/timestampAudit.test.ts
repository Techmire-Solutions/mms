import { describe, expect, it } from "vitest";
import {
  summarizeTimestampColumns,
  type NaiveTimestampColumn,
} from "../scripts/timestampAuditCore.js";

const column = (
  table: string,
  name: string,
  estimatedRows: number | null,
  scope: "tenant" | "global" = "tenant",
): NaiveTimestampColumn => ({
  table,
  column: name,
  nullable: true,
  scope,
  estimatedRows,
});

describe("summarizeTimestampColumns", () => {
  it("counts columns, tables and tenant/global scope", () => {
    const summary = summarizeTimestampColumns([
      column("students", "created_at", 100),
      column("students", "updated_at", 100),
      column("platform_settings", "updated_at", 3, "global"),
    ]);
    expect(summary.totalColumns).toBe(3);
    expect(summary.totalTables).toBe(2);
    expect(summary.tenantColumns).toBe(2);
    expect(summary.globalColumns).toBe(1);
  });

  it("sorts by estimated rows descending, then by table and column", () => {
    const summary = summarizeTimestampColumns([
      column("small", "created_at", 1),
      column("big", "updated_at", 500),
      column("big", "created_at", 500),
    ]);
    expect(summary.columns.map((c) => `${c.table}.${c.column}`)).toEqual([
      "big.created_at",
      "big.updated_at",
      "small.created_at",
    ]);
  });

  it("sorts unknown estimates last", () => {
    const summary = summarizeTimestampColumns([
      column("unknown", "created_at", null),
      column("known", "created_at", 0),
    ]);
    expect(summary.columns.map((c) => c.table)).toEqual(["known", "unknown"]);
  });

  it("handles an empty inventory", () => {
    expect(summarizeTimestampColumns([])).toEqual({
      totalColumns: 0,
      totalTables: 0,
      tenantColumns: 0,
      globalColumns: 0,
      columns: [],
    });
  });
});

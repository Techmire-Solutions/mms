import { describe, expect, it } from "vitest";
import { SEAT_RELEASED_ENROLLMENT_STATUSES } from "@mms/contracts";
import { studentScopeExistsSql } from "../db/repositories/studentScopeSql.js";

/** Render a Drizzle SQL object into a comparable string (mirrors the scoping spec helper). */
function renderSql(query: unknown): string {
  if (!query) return "";
  if (typeof query === "string") return query;
  if (typeof query === "object" && "queryChunks" in query) {
    return (query as { queryChunks: unknown[] }).queryChunks.map(renderSql).join("");
  }
  if (typeof query === "object" && "value" in query) {
    return String((query as { value: unknown }).value ?? "");
  }
  if (typeof query === "object" && "name" in query) {
    return String((query as { name: unknown }).name ?? "");
  }
  if (typeof query === "object" && "table" in query) {
    const table = (query as { table: Record<string | symbol, unknown> }).table;
    return String(table[Symbol.for("drizzle:Name")] ?? table.name ?? "?");
  }
  return String(query);
}

describe("studentScopeExistsSql", () => {
  it("denies everything when the scope is empty", () => {
    expect(renderSql(studentScopeExistsSql("demo", []))).toContain("1 = 0");
  });

  it("binds the tenant, sections and seat-released statuses", () => {
    const rendered = renderSql(studentScopeExistsSql("demo", ["sec-1", "sec-2"]));

    expect(rendered).toContain("e.workspace_subdomain");
    expect(rendered).toContain("e.section_id");
    expect(rendered).toContain("demo");
    expect(rendered).toContain("sec-1");
    expect(rendered).toContain("sec-2");
    expect(rendered).toContain("deleted_at");
    expect(rendered).toContain("status");
    for (const status of SEAT_RELEASED_ENROLLMENT_STATUSES) {
      expect(rendered).toContain(status);
    }
  });
});

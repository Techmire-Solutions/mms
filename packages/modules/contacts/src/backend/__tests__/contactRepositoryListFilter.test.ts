import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  CONTACT_SORT_FIELDS,
  DEFAULT_COLUMN_REGISTRY,
  resolveContactColumnSortField,
} from "@mms/contracts";
import { buildOrderBy } from "../repository/index.js";

const dialect = new PgDialect();

/** Renders the built ORDER BY expression to its SQL text (no params in it). */
function renderOrderBy(
  sortField: string | undefined,
  sortDir: "asc" | "desc" | "" | undefined,
): string {
  return dialect.sqlToQuery(buildOrderBy(sortField, sortDir)).sql;
}

/**
 * Every non-id sort needs `id asc` appended: without a unique tiebreaker,
 * equal sort keys have no guaranteed order, so page-walking exports can skip
 * or repeat rows across OFFSET pages (contacts sort by `name` by default).
 */
describe("contacts buildOrderBy", () => {
  it("appends an id tiebreaker to every CONTACT_SORT_FIELDS branch", () => {
    for (const field of CONTACT_SORT_FIELDS) {
      for (const dir of ["asc", "desc"] as const) {
        const rendered = renderOrderBy(field, dir);
        expect(rendered, `${field} ${dir}`).toContain('"contacts"."id" asc');
        expect(rendered.endsWith(', "contacts"."id" asc'), `${field} ${dir}`).toBe(true);
      }
    }
  });

  it("keeps the requested direction on the primary sort expression", () => {
    expect(renderOrderBy("name", "asc")).toBe('"contacts"."name" asc, "contacts"."id" asc');
    expect(renderOrderBy("name", "desc")).toBe('"contacts"."name" desc, "contacts"."id" asc');
    expect(renderOrderBy("createdAt", "desc")).toBe(
      '"contacts"."created_at" desc, "contacts"."id" asc',
    );
  });

  it("orders by every sortable Work column instead of silently falling back to id", () => {
    for (const entry of DEFAULT_COLUMN_REGISTRY.filter((column) => column.sortable)) {
      const field = resolveContactColumnSortField(entry.key);
      expect(field, entry.key).toBeDefined();
      const asc = renderOrderBy(field, "asc");
      const desc = renderOrderBy(field, "desc");
      expect(asc, entry.key).not.toBe('"contacts"."id" asc');
      expect(asc, entry.key).not.toBe(desc);
    }
  });

  it("keeps empty values last in both directions for optional columns", () => {
    for (const field of ["cnic", "dob", "city", "tag", "gender"]) {
      expect(renderOrderBy(field, "asc"), field).toContain("nulls last");
      expect(renderOrderBy(field, "desc"), field).toContain("nulls last");
    }
  });

  it("keeps the default id sort unchanged", () => {
    expect(renderOrderBy(undefined, undefined)).toBe('"contacts"."id" asc');
    expect(renderOrderBy("id", "desc")).toBe('"contacts"."id" asc');
    expect(renderOrderBy("notASortField", "asc")).toBe('"contacts"."id" asc');
  });
});

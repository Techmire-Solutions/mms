import { describe, expect, it } from "vitest";
import {
  resolveStudentFieldExpr,
  widgetNeedsContactsJoin,
} from "../db/repositories/studentRepositoryWidgetsSql.js";

/** Flattens a Drizzle SQL object into its literal text + column names for assertions. */
function renderSql(query: unknown): string {
  const out: string[] = [];
  const seen = new Set<unknown>();
  const visit = (node: unknown): void => {
    if (node == null || seen.has(node)) return;
    if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
      out.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node !== "object") return;
    seen.add(node);
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj.queryChunks)) {
      visit(obj.queryChunks);
      return;
    }
    if (typeof obj.name === "string") {
      out.push(obj.name);
      return;
    }
    if (Array.isArray(obj.value)) {
      out.push(obj.value.join(""));
      return;
    }
    if (obj.value !== undefined) {
      out.push(String(obj.value));
      return;
    }
    for (const value of Object.values(obj)) visit(value);
  };
  visit(query);
  return out.join("");
}

describe("students widget field SQL", () => {
  it("treats age as a contact-derived field so the contacts join is used", () => {
    expect(widgetNeedsContactsJoin({ xAxisField: "age", operation: "count" } as never)).toBe(true);
    expect(widgetNeedsContactsJoin({ targetField: "age", operation: "avg" } as never)).toBe(true);
    expect(widgetNeedsContactsJoin({ filterField: "age", operation: "count" } as never)).toBe(true);
  });

  it("derives age from the linked contact DOB instead of falling through to an empty literal", () => {
    // F-4: `age` is published in the students Reports catalog (isNumeric) but had no branch, so
    // every widget grouped into a constant "Unknown" bucket and sum/avg were always 0.
    const joined = renderSql(resolveStudentFieldExpr("age", true));
    expect(joined).toContain("dob");
    expect(joined).toContain("AGE");

    const subquery = renderSql(resolveStudentFieldExpr("age", false));
    expect(subquery).toContain("dob");
    expect(subquery).toContain("AGE");
  });

  it("still returns the empty literal for an unknown field", () => {
    expect(renderSql(resolveStudentFieldExpr("notAField"))).toBe("''");
  });
});

import { describe, expect, it } from "vitest";
import { dashboardContract } from "../contracts/dashboard.contract.js";
import { DASHBOARD_WIDGETS_MAX } from "./dashboardWidgetSchema.js";

const summaryQuery = dashboardContract.getSummary.query;
const reorderBody = dashboardContract.reorderWidgets.body;

describe("dashboard summary query", () => {
  it("accepts a calendar date plus the presentation-only role hint", () => {
    const parsed = summaryQuery.safeParse({ date: "2026-08-27", role: "admin" });
    expect(parsed.success).toBe(true);
  });

  it("rejects values that would become arbitrary Redis cache-key segments", () => {
    for (const date of ["today", "2026-08-27:*", "2026-13-99", "x".repeat(120)]) {
      expect(summaryQuery.safeParse({ date }).success).toBe(false);
    }
  });

  it("stays optional for the default dashboard load", () => {
    expect(summaryQuery.safeParse(undefined).success).toBe(true);
  });
});

describe("dashboard reorder body", () => {
  const entry = (id: string, sortOrder = 0) => ({ id, sortOrder });

  it("caps the order list at the widget write cap so an oversized body is a 400", () => {
    const atCap = Array.from({ length: DASHBOARD_WIDGETS_MAX }, (_, i) => entry(`w-${i}`));
    expect(reorderBody.safeParse({ order: atCap }).success).toBe(true);

    const overCap = [...atCap, entry("w-overflow")];
    expect(reorderBody.safeParse({ order: overCap }).success).toBe(false);
  });

  it("rejects sortOrder values the integer column cannot store", () => {
    for (const sortOrder of [1.5, -1, 2 ** 31, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(reorderBody.safeParse({ order: [entry("w-1", sortOrder)] }).success).toBe(false);
    }
  });

  it("accepts a bounded integer sortOrder", () => {
    expect(reorderBody.safeParse({ order: [entry("w-1", 0), entry("w-2", 499)] }).success).toBe(
      true,
    );
  });
});

import { describe, expect, it } from "vitest";
import { calculateCustomCardDynamicTrend } from "./reportCustomCardTrend";
import type { CustomCard } from "./reportCollectionTypes";

const baseCard = (overrides: Partial<CustomCard> = {}): CustomCard => ({
  id: "card-1",
  title: "Card",
  collection: "finance_invoices",
  operation: "count",
  targetField: "amount",
  filterField: "",
  filterOperator: "equals",
  filterValue: "",
  icon: "Users",
  color: "primary",
  subTextType: "dynamic",
  ...overrides,
});

describe("calculateCustomCardDynamicTrend", () => {
  it("returns 0 when collection has no dateField, no rows, or invalid dates", () => {
    expect(calculateCustomCardDynamicTrend(baseCard(), [], "finance_invoices")).toBe(0);
    expect(calculateCustomCardDynamicTrend(baseCard(), [{ id: 1 }], "questions")).toBe(0);
    expect(
      calculateCustomCardDynamicTrend(baseCard(), [{ dueDate: "not-a-date" }], "finance_invoices"),
    ).toBe(0);
  });

  it("computes trend across current and prior 30-day windows for count, sum, average, percentage, and hasanat", () => {
    const rows = [
      { dueDate: "2026-04-15", amount: 200, status: "paid" },
      { dueDate: "2026-04-10", amount: 100, status: "pending" },
      { dueDate: "2026-03-01", amount: 100, status: "paid" },
      { dueDate: "2025-11-01", amount: 500, status: "paid" },
    ];
    expect(
      calculateCustomCardDynamicTrend(baseCard({ operation: "count" }), rows, "finance_invoices"),
    ).toBe(100);
    expect(
      calculateCustomCardDynamicTrend(baseCard({ operation: "sum" }), rows, "finance_invoices"),
    ).toBe(200);
    expect(
      calculateCustomCardDynamicTrend(baseCard({ operation: "avg" }), rows, "finance_invoices"),
    ).toBe(50);
    expect(
      calculateCustomCardDynamicTrend(
        baseCard({
          operation: "percentage",
          filterField: "status",
          filterOperator: "equals",
          filterValue: "paid",
        }),
        rows,
        "finance_invoices",
      ),
    ).toBe(-50);

    // Current-only activity yields +100% trend
    expect(
      calculateCustomCardDynamicTrend(
        baseCard({ operation: "count" }),
        [{ dueDate: "2026-04-15", amount: 50 }],
        "finance_invoices",
      ),
    ).toBe(100);

    // Zero current & prior activity yields 0
    expect(
      calculateCustomCardDynamicTrend(
        baseCard({ operation: "sum", targetField: "missingField" }),
        [{ dueDate: "2026-04-15", amount: "n/a" }],
        "finance_invoices",
      ),
    ).toBe(0);

    // Hasanat points snapshot + deed quantity fallback
    const hasanatCard = baseCard({
      collection: "hasanat_distributions",
      operation: "sum",
      targetField: "points",
    });
    const denoms = [{ id: "d1", points: 10, label: "Prayer" }] as never;
    expect(
      calculateCustomCardDynamicTrend(
        hasanatCard,
        [
          { issuedDate: "2026-04-15", pointsSnapshot: 20 },
          { issuedDate: "2026-03-01", denominationId: "d1", quantity: 1 },
        ],
        "hasanat_distributions",
        denoms,
      ),
    ).toBe(100);
  });
});

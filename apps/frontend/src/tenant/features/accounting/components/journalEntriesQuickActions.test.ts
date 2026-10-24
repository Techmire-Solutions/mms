import { describe, expect, it } from "vitest";
import {
  MONEY_IN_ACTION_TAGS,
  MONEY_OUT_ACTION_TAGS,
  QUICK_ACTIONS,
  QUICK_ACTION_DIRECTIONS,
  extractAmountFromNaturalLanguage,
  parseNaturalLanguage,
  resolveEntryDirection,
} from "@/tenant/features/accounting/lib/journalEntriesQuickActions";

describe("parseNaturalLanguage", () => {
  it("maps common accounting phrases to quick actions", () => {
    expect(parseNaturalLanguage("collect monthly fee")?.id).toBe("fee_collection");
    expect(parseNaturalLanguage("pay staff salary")?.id).toBe("salary");
    expect(parseNaturalLanguage("received donation")?.id).toBe("donation");
    expect(parseNaturalLanguage("paid water utility")?.id).toBe("utilities");
    expect(parseNaturalLanguage("purchase classroom supplies")?.id).toBe("other_expense");
  });

  it("returns null when no quick action matches", () => {
    expect(parseNaturalLanguage("adjust opening balance")).toBeNull();
  });
});

describe("extractAmountFromNaturalLanguage", () => {
  it("extracts clean monetary amounts from natural language text", () => {
    expect(extractAmountFromNaturalLanguage("paid 1500 for electricity")).toBe("1500");
    expect(extractAmountFromNaturalLanguage("collected $250.50 tuition fee")).toBe("250.50");
    expect(extractAmountFromNaturalLanguage("received donation Rs. 5000")).toBe("5000");
  });

  it("returns null when no amount is present", () => {
    expect(extractAmountFromNaturalLanguage("paid electricity")).toBeNull();
  });
});

describe("quick action cash-flow direction", () => {
  it("keeps the money-in and money-out tag sets disjoint", () => {
    const overlap = [...MONEY_IN_ACTION_TAGS].filter((tag) => MONEY_OUT_ACTION_TAGS.has(tag));
    expect(overlap).toEqual([]);
  });

  it("tags the other-expense action as money out, never as Capital", () => {
    const otherExpense = QUICK_ACTIONS.find(
      (quickAction) => quickAction.type.id === "other_expense",
    )?.type;
    expect(otherExpense?.tag).toBe("Expense");
    expect(MONEY_IN_ACTION_TAGS.has("Expense")).toBe(false);
    expect(MONEY_OUT_ACTION_TAGS.has("Expense")).toBe(true);
  });

  it("takes each action's direction from its own group", () => {
    expect(QUICK_ACTION_DIRECTIONS.fee_collection).toBe("in");
    expect(QUICK_ACTION_DIRECTIONS.donation).toBe("in");
    expect(QUICK_ACTION_DIRECTIONS.salary).toBe("out");
    expect(QUICK_ACTION_DIRECTIONS.utilities).toBe("out");
    expect(QUICK_ACTION_DIRECTIONS.other_expense).toBe("out");
  });

  it("resolves a posted expense as money out even when it carries the old Capital tag", () => {
    // Entries written before the tag fix still hold the wrong tag: the
    // transaction type must win so the row is not shown as a green inflow.
    expect(resolveEntryDirection({ tags: ["Capital"], transaction_type: "other_expense" })).toBe(
      "out",
    );
    expect(resolveEntryDirection({ tags: ["Expense"] })).toBe("out");
    expect(resolveEntryDirection({ tags: ["Fees"] })).toBe("in");
    expect(resolveEntryDirection({ tags: ["Donation"] })).toBe("in");
    expect(resolveEntryDirection({ tags: ["Reversal"] })).toBeNull();
    expect(resolveEntryDirection({})).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  JOURNAL_TEMPLATE_SEEDS,
  buildSeedJournalTemplates,
  normalizeJournalTemplates,
} from "./accountingJournalTemplates.js";

describe("normalizeJournalTemplates", () => {
  it("given malformed, duplicate-id and duplicate-name rows, should keep only the first valid unique ones", () => {
    // Arrange
    const raw = [
      { id: "petty", name: "Petty Cash", debitAccountId: "a1", creditAccountId: "a2" },
      { id: "petty", name: "Other", debitAccountId: "", creditAccountId: "" },
      { id: "dup-name", name: "petty cash", debitAccountId: "", creditAccountId: "" },
      { id: "", name: "No id" },
      "not-an-object",
      { id: "bank", name: "Bank Payment" },
    ];

    // Act
    const templates = normalizeJournalTemplates(raw);

    // Assert
    expect(templates).toEqual([
      { id: "petty", name: "Petty Cash", debitAccountId: "a1", creditAccountId: "a2" },
      { id: "bank", name: "Bank Payment", debitAccountId: "", creditAccountId: "" },
    ]);
  });

  it("given a non-array value, should return an empty list", () => {
    // Arrange
    const raw = { id: "x" };

    // Act
    const templates = normalizeJournalTemplates(raw);

    // Assert
    expect(templates).toEqual([]);
  });
});

describe("buildSeedJournalTemplates", () => {
  it("given a chart missing some seed codes, should resolve known codes to ids and leave unknown heads blank", () => {
    // Arrange
    const accounts = [
      { id: "acc-petty", code: "10200" },
      { id: "acc-ga", code: "61500" },
      { id: "acc-bank", code: "10300", isActive: false },
    ];

    // Act
    const templates = buildSeedJournalTemplates(accounts, (key) => `t:${key}`);

    // Assert
    expect(templates).toHaveLength(JOURNAL_TEMPLATE_SEEDS.length);
    expect(templates[0]).toEqual({
      id: "petty-cash-expense",
      name: "t:accounting.templates.seed.pettyCashExpense",
      debitAccountId: "acc-ga",
      creditAccountId: "acc-petty",
    });
    expect(templates.find((template) => template.id === "bank-payment")).toEqual({
      id: "bank-payment",
      name: "t:accounting.templates.seed.bankPayment",
      debitAccountId: "acc-ga",
      creditAccountId: "",
    });
  });
});

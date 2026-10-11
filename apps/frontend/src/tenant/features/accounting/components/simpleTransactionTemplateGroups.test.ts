import { describe, expect, it } from "vitest";
import type { Account, JournalTemplate } from "@mms/shared";
import {
  buildTemplateTransactionGroups,
  resolveWizardTransactionGroups,
} from "./simpleTransactionTemplateGroups";
import { TRANSACTION_GROUPS } from "./simpleTransactionWizardGroups";

const account = (id: string, code: string, type: Account["type"], name: string): Account => ({
  id,
  code,
  name,
  type,
  subtype: type === "Asset" ? "Cash & Bank" : "",
  description: "",
  isActive: true,
});

const accounts = [
  account("cash", "10100", "Asset", "Cash"),
  account("bank", "10300", "Asset", "Bank Accounts"),
  account("fees", "42000", "Revenue", "Service Revenue"),
  account("rent", "60200", "Expense", "Rent"),
  account("payable", "21100", "Liability", "Accounts Payable"),
];

const template = (
  id: string,
  debitAccountId: string,
  creditAccountId: string,
): JournalTemplate => ({
  id,
  name: `T ${id}`,
  debitAccountId,
  creditAccountId,
});

describe("buildTemplateTransactionGroups", () => {
  it("given templates on cash and non-cash heads, should group by which side is cash and skip templates without a cash head", () => {
    // Arrange
    const templates = [
      template("fee", "cash", "fees"),
      template("rent", "rent", "bank"),
      template("deposit", "bank", "cash"),
      template("accrual", "rent", "payable"),
    ];

    // Act
    const groups = buildTemplateTransactionGroups(templates, accounts);

    // Assert
    expect(groups.map((group) => [group.groupKey, group.items.map((item) => item.id)])).toEqual([
      ["accounting.journal.dashboard.group.moneyIn", ["tpl:fee"]],
      ["accounting.journal.dashboard.group.moneyOut", ["tpl:rent"]],
      ["accounting.journal.dashboard.group.transfers", ["tpl:deposit"]],
    ]);
    expect(groups[1].items[0]).toMatchObject({
      label: "T rent",
      tag: "T rent",
      debitAcc: "rent",
      creditAcc: "bank",
      color: "red",
    });
  });
});

describe("resolveWizardTransactionGroups", () => {
  it("given no template fits the wizard, should fall back to the built-in groups", () => {
    // Arrange
    const templates = [template("accrual", "rent", "payable")];

    // Act
    const groups = resolveWizardTransactionGroups(templates, accounts);

    // Assert
    expect(groups).toBe(TRANSACTION_GROUPS);
  });
});

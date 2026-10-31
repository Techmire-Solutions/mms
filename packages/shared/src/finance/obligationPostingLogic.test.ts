import { describe, expect, it } from "vitest";
import {
  buildObligationPostingLines,
  buildObligationRevisionKey,
  resolveObligationAssetAccount,
  type ObligationPostingInput,
} from "./obligationPostingLogic.js";

const KNOWN_ACCOUNTS = new Set([
  "acc-cash",
  "acc-bank",
  "acc-inc",
  "acc-liab",
  "acc-sahm-imam",
  "acc-sahm-sadat",
  "acc-1",
  "acc-2",
  "acc-3",
]);

describe("obligationPostingLogic", () => {
  const baseInput: ObligationPostingInput = {
    collectionId: "oc-1",
    receiptNo: "REC-100",
    amount: 1000,
    date: "2026-10-24",
    paymentMode: "Cash",
    description: "Khums receipt",
    cashAccountId: "acc-cash",
    bankAccountId: "acc-bank",
    defaultIncomeAccountId: "acc-inc",
    defaultLiabilityAccountId: "acc-liab",
    knownAccountIds: KNOWN_ACCOUNTS,
    distributions: [
      {
        id: "d1",
        name: "Sahm Imam",
        percentage: 50,
        type: "Income",
        accountId: "acc-sahm-imam",
      },
      {
        id: "d2",
        name: "Sahm Sadat",
        percentage: 50,
        type: "Liability",
        accountId: "acc-sahm-sadat",
      },
    ],
  };

  it("resolves asset accounts based on paymentMode", () => {
    expect(
      resolveObligationAssetAccount("Cash", {
        cashAccountId: "acc-cash",
        bankAccountId: "acc-bank",
      }),
    ).toBe("acc-cash");
    expect(
      resolveObligationAssetAccount("Bank", {
        cashAccountId: "acc-cash",
        bankAccountId: "acc-bank",
      }),
    ).toBe("acc-bank");
    expect(
      resolveObligationAssetAccount("Online", {
        cashAccountId: "acc-cash",
        bankAccountId: "acc-bank",
      }),
    ).toBe("acc-bank");
    expect(
      resolveObligationAssetAccount("Cheque", {
        cashAccountId: "acc-cash",
        bankAccountId: "acc-bank",
      }),
    ).toBe("acc-bank");
  });

  it("builds a balanced Dr Cash / Cr Distributions journal entry", () => {
    const lines = buildObligationPostingLines(baseInput);
    expect(lines).not.toBeNull();
    expect(lines).toHaveLength(3);

    // Dr Cash 1000
    expect(lines![0]).toEqual({
      id: "oc-dr-oc-1",
      account_id: "acc-cash",
      debit: 1000,
      credit: 0,
      description: "Received via Cash",
    });

    // Cr Sahm Imam 500
    expect(lines![1]).toEqual({
      id: "oc-cr-oc-1-d1",
      account_id: "acc-sahm-imam",
      debit: 0,
      credit: 500,
      description: "Sahm Imam (50%)",
    });

    // Cr Sahm Sadat 500
    expect(lines![2]).toEqual({
      id: "oc-cr-oc-1-d2",
      account_id: "acc-sahm-sadat",
      debit: 0,
      credit: 500,
      description: "Sahm Sadat (50%)",
    });

    const sumDr = lines!.reduce((acc, l) => acc + l.debit, 0);
    const sumCr = lines!.reduce((acc, l) => acc + l.credit, 0);
    expect(sumDr).toBe(sumCr);
  });

  it("falls back to default income/liability accounts when distributions have no explicit accountId", () => {
    const input: ObligationPostingInput = {
      ...baseInput,
      distributions: [
        { id: "d1", name: "Madrassah", percentage: 40, type: "Income" },
        { id: "d2", name: "Marja", percentage: 60, type: "Liability" },
      ],
    };

    const lines = buildObligationPostingLines(input);
    expect(lines).not.toBeNull();
    expect(lines![1].account_id).toBe("acc-inc");
    expect(lines![1].credit).toBe(400);
    expect(lines![2].account_id).toBe("acc-liab");
    expect(lines![2].credit).toBe(600);
  });

  it("reconciles penny rounding differences on uneven splits", () => {
    const input: ObligationPostingInput = {
      ...baseInput,
      amount: 100,
      distributions: [
        { id: "d1", name: "Part A", percentage: 33.33, type: "Income", accountId: "acc-1" },
        { id: "d2", name: "Part B", percentage: 33.33, type: "Income", accountId: "acc-2" },
        { id: "d3", name: "Part C", percentage: 33.34, type: "Income", accountId: "acc-3" },
      ],
    };

    const lines = buildObligationPostingLines(input);
    expect(lines).not.toBeNull();
    expect(lines).toHaveLength(4);

    const sumDr = lines!.reduce((acc, l) => acc + l.debit, 0);
    const sumCr = lines!.reduce((acc, l) => acc + l.credit, 0);
    expect(sumDr).toBe(100);
    expect(sumCr).toBe(100);
  });

  it("returns null if amount <= 0 or no receiving account exists", () => {
    expect(buildObligationPostingLines({ ...baseInput, amount: 0 })).toBeNull();
    expect(
      buildObligationPostingLines({ ...baseInput, cashAccountId: null, bankAccountId: null }),
    ).toBeNull();
  });

  it("given an account outside the chart of accounts, should refuse to post when building lines", () => {
    // Arrange
    const input: ObligationPostingInput = {
      ...baseInput,
      distributions: [
        { id: "d1", name: "Stale mapping", percentage: 100, type: "Income", accountId: "acc-gone" },
      ],
    };

    // Act
    const lines = buildObligationPostingLines(input);

    // Assert
    expect(lines).toBeNull();
  });

  it("given a receiving account outside the chart, should refuse to post when building lines", () => {
    // Arrange
    const input: ObligationPostingInput = { ...baseInput, cashAccountId: "acc-removed" };

    // Act
    const lines = buildObligationPostingLines(input);

    // Assert
    expect(lines).toBeNull();
  });

  it("given an unmapped liability distribution and no default, should refuse to post", () => {
    // Arrange
    const input: ObligationPostingInput = {
      ...baseInput,
      defaultLiabilityAccountId: null,
      distributions: [{ id: "d1", name: "Marja", percentage: 100, type: "Liability" }],
    };

    // Act
    const lines = buildObligationPostingLines(input);

    // Assert
    expect(lines).toBeNull();
  });
});

describe("buildObligationRevisionKey", () => {
  const source = {
    amount: 1000,
    payment_mode: "Cash",
    received_date: "2026-06-15",
    obligation_type_id: "ot-1",
    mujtahid_representative_id: "rep-1",
  };

  it("given identical posting fields, should return the same key when the mode casing differs", () => {
    // Arrange
    const other = { ...source, payment_mode: " cash " };

    // Act
    const key = buildObligationRevisionKey(source);

    // Assert
    expect(buildObligationRevisionKey(other)).toBe(key);
  });

  it("given a changed amount, should return a different key when compared", () => {
    // Arrange
    const edited = { ...source, amount: 1200 };

    // Act
    const key = buildObligationRevisionKey(edited);

    // Assert
    expect(key).not.toBe(buildObligationRevisionKey(source));
  });

  it("given a changed payment mode or date, should return a different key when compared", () => {
    // Arrange
    const baseKey = buildObligationRevisionKey(source);

    // Act
    const modeKey = buildObligationRevisionKey({ ...source, payment_mode: "Online" });
    const dateKey = buildObligationRevisionKey({ ...source, received_date: "2026-06-16" });

    // Assert
    expect(modeKey).not.toBe(baseKey);
    expect(dateKey).not.toBe(baseKey);
  });
});

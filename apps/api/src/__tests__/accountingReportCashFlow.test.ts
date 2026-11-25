import { describe, expect, it } from "vitest";
import {
  buildCashFlowFigures,
  type CashEntryMovement,
  type CashFlowSection,
  type ReportAccountRow,
} from "@mms/mod-accounting/backend/repository";

const row = (
  id: string,
  type: ReportAccountRow["type"],
  debit: number,
  credit: number,
): ReportAccountRow => ({
  id,
  code:
    type === "Asset"
      ? id === "cash" || id === "bank"
        ? "1010"
        : "1999"
      : type === "Revenue"
        ? "4000"
        : "5000",
  name: id,
  type,
  subtype: "",
  totalDebitCents: debit,
  totalCreditCents: credit,
  balanceCents: type === "Asset" || type === "Expense" ? debit - credit : credit - debit,
  cashFlowSection: "operating",
});

describe("buildCashFlowFigures", () => {
  it("excludes an internal cash transfer from gross inflow/outflow", () => {
    // Dr Bank 100 / Cr Cash 100 is one entry with both legs on cash accounts.
    const transfer: CashEntryMovement = {
      entryId: "e-transfer",
      cashDebitCents: 10_000,
      cashCreditCents: 10_000,
    };
    const receipt: CashEntryMovement = {
      entryId: "e-receipt",
      cashDebitCents: 50_000,
      cashCreditCents: 0,
    };
    const figures = buildCashFlowFigures(
      [row("cash", "Asset", 10_000 + 50_000, 10_000), row("bank", "Asset", 10_000, 0)],
      [transfer, receipt],
      0,
      {},
      new Map(),
      new Map(),
    );
    expect(figures.cashInflowCents).toBe(50_000);
    expect(figures.cashOutflowCents).toBe(0);
    expect(figures.netCashFlowCents).toBe(50_000);
  });

  it("splits an asymmetric cash entry into its net legs", () => {
    // A bank charge entry: Dr Bank 10,000 (deposit), Cr Bank 200 (fee) in one voucher.
    const figures = buildCashFlowFigures(
      [row("bank", "Asset", 10_000, 200)],
      [{ entryId: "e-1", cashDebitCents: 10_000, cashCreditCents: 200 }],
      0,
      {},
      new Map(),
      new Map(),
    );
    expect(figures.cashInflowCents).toBe(9_800);
    expect(figures.cashOutflowCents).toBe(0);
    expect(figures.netCashFlowCents).toBe(9_800);
  });

  it("reconciles the indirect total with the direct movement by construction", () => {
    // Balanced ledger: Dr cash 10,000 / prepaid 2,000 / expenses 1,500 = 13,500;
    // Cr cash 4,500 / fees 7,500 / accumulated depreciation 300 / accrued 1,200.
    // netSurplus 6,000; prepaid 2,000 and contra-asset 300 and accrual 1,200 explain
    // the 5,500 cash movement without any name-based add-back.
    const flowRows: ReportAccountRow[] = [
      row("cash", "Asset", 10_000, 4_500),
      row("prepaid", "Asset", 2_000, 0),
      row("accumulated-depreciation", "Asset", 0, 300),
      row("accrued-liability", "Liability", 0, 1_200),
      row("fees", "Revenue", 0, 7_500),
      row("expenses", "Expense", 1_500, 0),
    ];
    const figures = buildCashFlowFigures(
      flowRows,
      [{ entryId: "e-1", cashDebitCents: 10_000, cashCreditCents: 4_500 }],
      6_000,
      {},
      new Map(),
      new Map(),
    );
    expect(figures.netCashFlowCents).toBe(5_500);
    expect(figures.netCashFlowIndirectCents).toBe(figures.netCashFlowCents);
    const { depreciationCents, receivablesCents, payablesCents, otherCents } = figures.adjustments;
    expect(6_000 + depreciationCents + receivablesCents + payablesCents + otherCents).toBe(
      figures.netCashFlowIndirectCents,
    );
    // The accrual and contra-asset stay in the residual, not lost.
    expect(otherCents).not.toBe(0);
  });

  it("keeps the named adjustments and puts the remainder in `other`", () => {
    const flowRows: ReportAccountRow[] = [
      row("receivable", "Asset", 4_000, 0),
      row("payable", "Liability", 0, 1_000),
      row("prepaid", "Asset", 900, 0),
      row("fees", "Revenue", 0, 5_000),
    ];
    const figures = buildCashFlowFigures(flowRows, [], 5_000, {}, new Map(), new Map());
    expect(figures.adjustments.receivablesCents).toBe(-4_000);
    expect(figures.adjustments.payablesCents).toBe(1_000);
    expect(figures.adjustments.otherCents).not.toBe(0);
  });

  it("classifies a cash movement by its non-cash counterpart's section", () => {
    const flowRows: ReportAccountRow[] = [
      { ...row("cash", "Asset", 20_000, 5_000), cashFlowSection: "operating" },
      { ...row("equipment", "Asset", 8_000, 0), cashFlowSection: "investing" },
      { ...row("share-capital", "Equity", 0, 12_000), cashFlowSection: "financing" },
      { ...row("fees", "Revenue", 0, 11_000), cashFlowSection: "operating" },
    ];
    const sectionById = new Map<string, CashFlowSection>([
      ["equipment", "investing"],
      ["share-capital", "financing"],
      ["fees", "operating"],
      ["cash", "operating"],
    ]);
    // e-investing: Dr equipment 8,000 / Cr cash 8,000 (cash leg net -8,000 → outflow).
    // e-financing: Dr cash 12,000 / Cr share-capital 12,000 (cash leg net +12,000 → inflow).
    // e-revenue:   Dr cash 11,000 / Cr fees 11,000 (cash leg net +11,000 → operating).
    const movements: CashEntryMovement[] = [
      { entryId: "e-investing", cashDebitCents: 0, cashCreditCents: 8_000 },
      { entryId: "e-financing", cashDebitCents: 12_000, cashCreditCents: 0 },
      { entryId: "e-revenue", cashDebitCents: 11_000, cashCreditCents: 0 },
    ];
    const counterparties = new Map<string, readonly string[]>([
      ["e-investing", ["equipment"]],
      ["e-financing", ["share-capital"]],
      ["e-revenue", ["fees"]],
    ]);

    const figures = buildCashFlowFigures(flowRows, movements, 0, {}, sectionById, counterparties);

    expect(figures.sections.operating).toEqual({
      inflowCents: 11_000,
      outflowCents: 0,
      netCents: 11_000,
      indirectCents: 0,
    });
    expect(figures.sections.investing).toEqual({
      inflowCents: 0,
      outflowCents: 8_000,
      netCents: -8_000,
      indirectCents: -8_000,
    });
    expect(figures.sections.financing).toEqual({
      inflowCents: 12_000,
      outflowCents: 0,
      netCents: 12_000,
      indirectCents: 12_000,
    });
    expect(figures.cashInflowCents).toBe(23_000);
    expect(figures.cashOutflowCents).toBe(8_000);
    // The sections partition the total indirect figure by construction.
    expect(
      figures.sections.operating.indirectCents +
        figures.sections.investing.indirectCents +
        figures.sections.financing.indirectCents,
    ).toBe(figures.netCashFlowIndirectCents);
  });
});

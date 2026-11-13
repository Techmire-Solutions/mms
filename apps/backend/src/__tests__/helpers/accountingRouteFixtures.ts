import type { HedgeRelationship, Ias29Run, JournalEntry } from "@mms/shared";

/**
 * Contract-complete route fixtures.
 *
 * The route handlers validate their responses against the shared schemas, so a
 * mock that returns a partial object is a contract violation (500). These
 * factories return exactly what the use cases emit, which also keeps the mocks
 * honest: if a schema changes, the fixture stops compiling.
 */

export function makeHedgeRelationship(
  overrides: Partial<HedgeRelationship> = {},
): HedgeRelationship {
  return {
    id: "hedge-1",
    name: "USD import hedge",
    hedgeType: "cash_flow",
    direction: "buy",
    currency: "USD",
    notional: "1000",
    contractRate: "283",
    designationRate: "285",
    designationDate: "2026-10-01",
    maturityDate: "2027-01-31",
    hedgedItem: "Forecast USD purchase",
    riskManagementObjective: "Fix the PKR cost of the import",
    instrumentAccountId: "deriv",
    reserveAccountId: "cfhr",
    pnlAccountId: "hpl",
    status: "active",
    settledReserve: "0",
    valuations: [],
    ...overrides,
  };
}

export function makeIas29Run(overrides: Partial<Ias29Run> = {}): Ias29Run {
  return {
    id: "ias29-1",
    restatementDate: "2026-12-31",
    status: "posted",
    closingIndex: "125",
    netMonetaryResult: "-100",
    entryId: "je-ias29",
    reversalEntryId: "je-ias29-rev",
    lines: [
      {
        accountId: "land",
        accountCode: "1500",
        accountName: "Land",
        carrying: "600",
        restated: "750",
        adjustment: "150",
      },
    ],
    ...overrides,
  };
}

export function makeReversalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "je-rev",
    date: "2026-10-08",
    ref: "REV-JV-1",
    description: "Reversal of JV-1: Posted to the wrong account",
    status: "posted",
    created_by: "Amina Accountant",
    tags: ["Reversal"],
    attachments: [],
    fiscal_year: "2026",
    lines: [
      {
        id: "l1",
        account_id: "office",
        debit: 0,
        credit: 50000,
        description: "",
      },
      {
        id: "l2",
        account_id: "cash",
        debit: 50000,
        credit: 0,
        description: "",
      },
    ],
    ...overrides,
  };
}

export function makeReversalResult(
  overrides: Partial<{ priorPeriod: boolean; executedAt: string }> = {},
) {
  return {
    entry: makeReversalEntry(),
    original: { id: "je-orig", ref: "JV-1", date: "2026-09-15" },
    priorPeriod: overrides.priorPeriod ?? false,
    executedAt: overrides.executedAt ?? "2026-10-08T09:30:00.000Z",
  };
}

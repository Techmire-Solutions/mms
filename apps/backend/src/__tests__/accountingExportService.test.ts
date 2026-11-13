import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@mms/shared";

const mockLoadAccountsPage = vi.fn();
const mockListLedgerRows = vi.fn();

vi.mock("../accounting/use-cases/accountingUseCases.js", () => ({
  accountingUseCases: {
    loadAccountsPage: (...args: unknown[]) => mockLoadAccountsPage(...args),
  },
}));

vi.mock("../db/repositories/accountingLedgerDocumentRepository.js", () => ({
  listLedgerExportRows: (...args: unknown[]) => mockListLedgerRows(...args),
  // The report-documents adapter imports both loaders; a partial mock would make
  // the adapter fail at import time with "No export is defined".
  loadLedgerDocument: vi.fn(),
}));

import { runWithTenant } from "../lib/tenantContext.js";
import {
  accountingChartExportService,
  generateLedgerExportCsv,
} from "../services/accountingExportService.js";

const account = (overrides: Partial<Account> = {}): Account =>
  ({
    id: "acc-1",
    code: "1000",
    name: "Cash",
    type: "Asset",
    subtype: "",
    description: "",
    isActive: true,
    ...overrides,
  }) as Account;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("accounting chart-of-accounts export", () => {
  it("streams the SSOT columns and neutralises formula injection", async () => {
    mockLoadAccountsPage.mockResolvedValue({
      accounts: [
        account({ code: "1000", name: "Cash" }),
        account({ id: "acc-2", code: "4000", name: '=HYPERLINK("http://x","!"', type: "Revenue" }),
      ],
      total: 2,
      page: 1,
      limit: 250,
    });

    const result = await runWithTenant("demo", () =>
      accountingChartExportService.buildExport({}, { viewerRole: "accountant", filename: "coa" }),
    );

    expect(result.filename).not.toContain("/");
    expect(result.count).toBe(2);
    // Header comes from the module transfer schema.
    expect(result.csv).toContain('"Account Code"');
    // A cell starting with `=` is prefixed so a spreadsheet cannot evaluate it.
    expect(result.csv).toContain(`"'=HYPERLINK(""http://x"",""!""`);
    expect(result.csv).toContain('"1000"');
  });

  it("refuses an XLSX export above the materialisation ceiling", async () => {
    mockLoadAccountsPage.mockResolvedValue({
      accounts: Array.from({ length: 250 }, (_, index) =>
        account({ id: `acc-${index}`, code: `${1000 + index}` }),
      ),
      total: 12_000,
      page: 1,
      limit: 250,
    });

    await expect(
      runWithTenant("demo", () =>
        accountingChartExportService.buildExport(
          {},
          { viewerRole: "accountant", filename: "coa", format: "xlsx" },
        ),
      ),
    ).rejects.toMatchObject({ statusCode: 413, type: "payload_too_large" });
  });
});

describe("general-ledger streamed export", () => {
  it("pages with the keyset cursor until the register is exhausted", async () => {
    mockListLedgerRows
      .mockResolvedValueOnce({
        rows: [
          {
            date: "2026-11-01",
            ref: "JE-1",
            description: "Fee",
            lineNote: "",
            debit: "100.00",
            credit: "0.00",
          },
        ],
        hasMore: true,
        nextCursor: "2026-11-01|je-1|l1",
      })
      .mockResolvedValueOnce({
        rows: [
          {
            date: "2026-11-02",
            ref: "JE-2",
            description: "Fee",
            lineNote: "",
            debit: "50.00",
            credit: "0.00",
          },
        ],
        hasMore: false,
      });

    const generator = generateLedgerExportCsv(
      "demo",
      { accountId: "acc-1", dateFrom: "2026-11-01", dateTo: "2026-11-30" },
      { filename: "ledger" },
    );
    const chunks: string[] = [];
    for (;;) {
      const step = await generator.next();
      if (step.done) break;
      chunks.push(step.value);
    }
    const csv = chunks.join("");

    expect(mockListLedgerRows).toHaveBeenCalledTimes(2);
    expect(mockListLedgerRows.mock.calls[1][3]).toEqual({
      date: "2026-11-01",
      entryId: "je-1",
      lineId: "l1",
    });
    expect(csv).toContain('"Reference"');
    expect(csv).toContain('"JE-1"');
    expect(csv).toContain('"JE-2"');
  });
});

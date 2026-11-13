import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLoadAccountsPage = vi.fn();
const mockUpsertAccounts = vi.fn();

vi.mock("../accounting/use-cases/accountingUseCases.js", () => ({
  accountingUseCases: {
    loadAccountsPage: (...args: unknown[]) => mockLoadAccountsPage(...args),
    upsertAccounts: (...args: unknown[]) => mockUpsertAccounts(...args),
  },
}));

vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { importAccountingAccounts } from "../services/backgroundJobAccountingRunners.js";

const ctx = (overrides: Record<string, unknown> = {}) => ({
  tenant: "demo",
  userId: "u1",
  signal: undefined,
  updateProgress: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const row = (code: string, name: string, type = "Asset") => ({ code, name, type });

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadAccountsPage.mockResolvedValue({ accounts: [], total: 0, page: 1, limit: 500 });
  mockUpsertAccounts.mockResolvedValue(undefined);
});

describe("chart-of-accounts CSV import runner", () => {
  it("imports new accounts and reports progress", async () => {
    const progress = vi.fn().mockResolvedValue(undefined);
    const result = await importAccountingAccounts(
      [row("1000", "Cash"), row("4000", "Fees", "Revenue")],
      ctx({ updateProgress: progress }),
    );

    expect(result).toMatchObject({ imported: 2, failed: 0, total: 2 });
    expect(mockUpsertAccounts).toHaveBeenCalledTimes(1);
    const saved = mockUpsertAccounts.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(saved.map((a) => a.code)).toEqual(["1000", "4000"]);
    expect(progress).toHaveBeenCalledWith(2, 2);
  });

  it("reuses the stored id for an existing code so a replay updates instead of duplicating", async () => {
    mockLoadAccountsPage.mockResolvedValue({
      accounts: [{ id: "acc-1", code: "1000", name: "Cash", type: "Asset" }],
      total: 1,
      page: 1,
      limit: 500,
    });

    await importAccountingAccounts([row("1000", "Cash on hand")], ctx());

    const saved = mockUpsertAccounts.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(saved[0]).toMatchObject({ id: "acc-1", code: "1000", name: "Cash on hand" });
  });

  it("fails only the row with an invalid currency instead of the whole job", async () => {
    // The DTO accepts up to 10 characters, the column is varchar(3) and the write
    // path re-validates with the ISO schema; an unchecked cell aborted the batch
    // inside upsertAccounts with no row number.
    const result = await importAccountingAccounts(
      [
        { ...row("1000", "Cash"), currency: "PKR" },
        { ...row("1100", "Bad currency"), currency: "US" },
        row("1200", "No currency"),
      ],
      ctx(),
    );

    expect(result.imported).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual([
      { row: 2, reason: "currency must be a 3-letter ISO currency code" },
    ]);
    const saved = mockUpsertAccounts.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(saved.map((account) => account.accountCurrency)).toEqual(["PKR", null]);
  });

  it("reports invalid rows and duplicate codes without failing the batch", async () => {
    const result = await importAccountingAccounts(
      [
        row("1000", "Cash"),
        row("1000", "Cash duplicate"),
        row("1100", "Bad type", "Bogus"),
        { code: "", name: "No code", type: "Asset" },
      ],
      ctx(),
    );

    expect(result.imported).toBe(1);
    expect(result.failed).toBe(3);
    expect(result.errors.map((e) => e.row)).toEqual([2, 3, 4]);
    expect(mockUpsertAccounts).toHaveBeenCalledTimes(1);
  });

  it("chunks a large chart and honours the row ceiling", async () => {
    const rows = Array.from({ length: 150 }, (_, i) => row(`${2000 + i}`, `Account ${i}`));
    const result = await importAccountingAccounts(rows, ctx());
    expect(result.imported).toBe(150);
    expect(mockUpsertAccounts).toHaveBeenCalledTimes(2);

    await expect(
      importAccountingAccounts(
        Array.from({ length: 2001 }, (_, i) => row(`${3000 + i}`, `A ${i}`)),
        ctx(),
      ),
    ).rejects.toThrow(/limited to 2000 rows/);
  });

  it("stops before the next chunk when the job is aborted", async () => {
    const controller = new AbortController();
    mockUpsertAccounts.mockImplementationOnce(async () => {
      controller.abort();
    });
    const rows = Array.from({ length: 150 }, (_, i) => row(`${4000 + i}`, `Account ${i}`));

    await expect(
      importAccountingAccounts(rows, ctx({ signal: controller.signal })),
    ).rejects.toMatchObject({ name: "AbortError" });
    // Only the first chunk committed before the abort was observed.
    expect(mockUpsertAccounts).toHaveBeenCalledTimes(1);
  });
});

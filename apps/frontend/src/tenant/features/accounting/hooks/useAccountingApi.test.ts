import { describe, expect, it, vi, beforeEach } from "vitest";

const apiContractMock = vi.hoisted(() => ({
  accounting: {
    listEntries: vi.fn(),
    listAccounts: vi.fn(),
    getReportAggregates: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ apiContract: apiContractMock }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: true }) }));

import {
  fetchAccountingEntriesPage,
  fetchAllAccountingAccounts,
  fetchAllAccountingEntries,
} from "./accountingListFetch";

/** A 200 contract envelope. */
const ok = (body: unknown) => ({ status: 200, body, headers: new Headers() });

/** The query record of the nth `listEntries` call. */
function entriesQuery(index: number): Record<string, unknown> {
  return (apiContractMock.accounting.listEntries.mock.calls[index]?.[0]?.query ?? {}) as Record<
    string,
    unknown
  >;
}

/** The query record of the nth `listAccounts` call. */
function accountsQuery(index: number): Record<string, unknown> {
  return (apiContractMock.accounting.listAccounts.mock.calls[index]?.[0]?.query ?? {}) as Record<
    string,
    unknown
  >;
}

describe("fetchAllAccountingEntries", () => {
  beforeEach(() => {
    apiContractMock.accounting.listEntries.mockReset();
  });

  it("pages through until hasMore is false, so aggregates see the whole journal", async () => {
    // A single capped page silently understated every client aggregate: the Trial
    // Balance summed the 100 most recently created entries and still reported
    // itself balanced.
    apiContractMock.accounting.listEntries
      .mockResolvedValueOnce(ok({ entries: [{ id: "e1" }, { id: "e2" }], hasMore: true }))
      .mockResolvedValueOnce(ok({ entries: [{ id: "e3" }], hasMore: false }));

    const entries = await fetchAllAccountingEntries({});

    expect(entries.map((entry) => entry.id)).toEqual(["e1", "e2", "e3"]);
    expect(apiContractMock.accounting.listEntries).toHaveBeenCalledTimes(2);
    expect(entriesQuery(0).page).toBe(1);
    expect(entriesQuery(1).page).toBe(2);
    // The REST contract caps `limit` at 100; asking for more is a 400, not a clamp.
    expect(entriesQuery(0).limit).toBe(100);
  });

  it("forwards every journal filter it is given", async () => {
    apiContractMock.accounting.listEntries.mockResolvedValueOnce(
      ok({ entries: [], hasMore: false }),
    );

    await fetchAllAccountingEntries({
      search: "INV-1",
      status: "posted",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      accountId: "acc-1",
    });

    const query = entriesQuery(0);
    expect(query.search).toBe("INV-1");
    expect(query.status).toBe("posted");
    expect(query.dateFrom).toBe("2026-01-01");
    expect(query.dateTo).toBe("2026-12-31");
    expect(query.accountId).toBe("acc-1");
  });

  it("stops when a page comes back empty even if hasMore is set", async () => {
    apiContractMock.accounting.listEntries
      .mockResolvedValueOnce(ok({ entries: [{ id: "e1" }], hasMore: true }))
      .mockResolvedValueOnce(ok({ entries: [], hasMore: true }));

    const entries = await fetchAllAccountingEntries({});

    expect(entries).toHaveLength(1);
    expect(apiContractMock.accounting.listEntries).toHaveBeenCalledTimes(2);
  });

  it("treats a missing entries array as the end of the list", async () => {
    apiContractMock.accounting.listEntries.mockResolvedValueOnce(ok({ hasMore: true }));

    await expect(fetchAllAccountingEntries({})).resolves.toEqual([]);
    expect(apiContractMock.accounting.listEntries).toHaveBeenCalledTimes(1);
  });
});

describe("fetchAllAccountingAccounts", () => {
  beforeEach(() => {
    apiContractMock.accounting.listAccounts.mockReset();
  });

  it("pages through the chart of accounts in a stable code order", async () => {
    // The live page used `page: 1, limit: 100` with the default `createdAt desc`
    // order, so a workspace with more than 100 accounts lost the remainder from
    // the chart, the journal account picker and every report.
    apiContractMock.accounting.listAccounts
      .mockResolvedValueOnce(ok({ accounts: [{ id: "a1" }], hasMore: true }))
      .mockResolvedValueOnce(ok({ accounts: [{ id: "a2" }], hasMore: false }));

    const accounts = await fetchAllAccountingAccounts();

    expect(accounts.map((account) => account.id)).toEqual(["a1", "a2"]);
    const query = accountsQuery(0);
    expect(query.sortField).toBe("code");
    expect(query.sortDir).toBe("asc");
    expect(query.limit).toBe(100);
    expect(query.includeDeleted).toBeUndefined();
  });

  it("requests the trash only when asked", async () => {
    apiContractMock.accounting.listAccounts.mockResolvedValueOnce(
      ok({ accounts: [], hasMore: false }),
    );

    await fetchAllAccountingAccounts({ includeDeleted: true });

    expect(accountsQuery(0).includeDeleted).toBe(true);
  });
});

describe("fetchAccountingEntriesPage", () => {
  beforeEach(() => {
    apiContractMock.accounting.listEntries.mockReset();
  });

  it("sends the page, the filters and the pinned date-descending order", async () => {
    apiContractMock.accounting.listEntries.mockResolvedValueOnce(
      ok({ entries: [], total: 340, page: 2, limit: 100, hasMore: true }),
    );

    const page = await fetchAccountingEntriesPage({
      page: 2,
      limit: 100,
      search: "INV-7",
      status: "draft",
      tag: "fee",
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
      sortField: "date",
      sortDir: "desc",
    });

    const query = entriesQuery(0);
    expect(query.page).toBe(2);
    expect(query.limit).toBe(100);
    expect(query.search).toBe("INV-7");
    expect(query.status).toBe("draft");
    // The tag filter reaches the server via the contract schema (it is on the
    // query schema), so the returned page is genuinely filtered.
    expect(query.tag).toBe("fee");
    expect(query.dateFrom).toBe("2026-01-01");
    expect(query.dateTo).toBe("2026-06-30");
    expect(query.sortField).toBe("date");
    expect(query.sortDir).toBe("desc");
    // The pager reads the server's total, not the length of the page.
    expect(page.total).toBe(340);
    expect(page.hasMore).toBe(true);
  });

  it("sends the trash flag and never asks beyond the contract page ceiling", async () => {
    apiContractMock.accounting.listEntries.mockResolvedValueOnce(ok({ entries: [], total: 0 }));

    await fetchAccountingEntriesPage({ page: 1, limit: 500, includeDeleted: true });

    expect(entriesQuery(0).includeDeleted).toBe(true);
    expect(entriesQuery(0).limit).toBe(100);
  });

  it("treats a legacy envelope without a total as a single page", async () => {
    apiContractMock.accounting.listEntries.mockResolvedValueOnce(ok({ entries: [{ id: "e1" }] }));

    const page = await fetchAccountingEntriesPage({ page: 1, limit: 100 });

    expect(page.entries.map((entry) => entry.id)).toEqual(["e1"]);
    expect(page.total).toBe(1);
    expect(page.hasMore).toBe(false);
  });
});

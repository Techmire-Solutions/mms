import { describe, expect, it, vi, beforeEach } from "vitest";

const apiJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({ apiJson: apiJsonMock }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock("@/lib/api", () => ({
  tsrClient: {
    accounting: {
      listEntries: { useQuery: vi.fn(() => ({ data: undefined })) },
      listAccounts: { useQuery: vi.fn(() => ({ data: undefined })) },
    },
  },
}));

import {
  fetchAccountingEntriesPage,
  fetchAllAccountingAccounts,
  fetchAllAccountingEntries,
} from "./accountingListFetch";

/** The query params of the nth apiJson call. */
function callParams(index: number): URLSearchParams {
  const url = String(apiJsonMock.mock.calls[index]?.[0] ?? "");
  return new URLSearchParams(url.split("?")[1] ?? "");
}

describe("fetchAllAccountingEntries", () => {
  beforeEach(() => {
    apiJsonMock.mockReset();
  });

  it("pages through until hasMore is false, so aggregates see the whole journal", async () => {
    // A single capped page silently understated every client aggregate: the Trial
    // Balance summed the 100 most recently created entries and still reported
    // itself balanced.
    apiJsonMock
      .mockResolvedValueOnce({ entries: [{ id: "e1" }, { id: "e2" }], hasMore: true })
      .mockResolvedValueOnce({ entries: [{ id: "e3" }], hasMore: false });

    const entries = await fetchAllAccountingEntries({});

    expect(entries.map((entry) => entry.id)).toEqual(["e1", "e2", "e3"]);
    expect(apiJsonMock).toHaveBeenCalledTimes(2);
    expect(callParams(0).get("page")).toBe("1");
    expect(callParams(1).get("page")).toBe("2");
    // The REST contract caps `limit` at 100; asking for more is a 400, not a clamp.
    expect(callParams(0).get("limit")).toBe("100");
  });

  it("forwards every journal filter it is given", async () => {
    apiJsonMock.mockResolvedValueOnce({ entries: [], hasMore: false });

    await fetchAllAccountingEntries({
      search: "INV-1",
      status: "posted",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      accountId: "acc-1",
    });

    const params = callParams(0);
    expect(params.get("search")).toBe("INV-1");
    expect(params.get("status")).toBe("posted");
    expect(params.get("dateFrom")).toBe("2026-01-01");
    expect(params.get("dateTo")).toBe("2026-12-31");
    expect(params.get("accountId")).toBe("acc-1");
  });

  it("stops when a page comes back empty even if hasMore is set", async () => {
    apiJsonMock
      .mockResolvedValueOnce({ entries: [{ id: "e1" }], hasMore: true })
      .mockResolvedValueOnce({ entries: [], hasMore: true });

    const entries = await fetchAllAccountingEntries({});

    expect(entries).toHaveLength(1);
    expect(apiJsonMock).toHaveBeenCalledTimes(2);
  });

  it("treats a missing entries array as the end of the list", async () => {
    apiJsonMock.mockResolvedValueOnce({ hasMore: true });

    await expect(fetchAllAccountingEntries({})).resolves.toEqual([]);
    expect(apiJsonMock).toHaveBeenCalledTimes(1);
  });
});

describe("fetchAllAccountingAccounts", () => {
  beforeEach(() => {
    apiJsonMock.mockReset();
  });

  it("pages through the chart of accounts in a stable code order", async () => {
    // The live page used `page: 1, limit: 100` with the default `createdAt desc`
    // order, so a workspace with more than 100 accounts lost the remainder from
    // the chart, the journal account picker and every report.
    apiJsonMock
      .mockResolvedValueOnce({ accounts: [{ id: "a1" }], hasMore: true })
      .mockResolvedValueOnce({ accounts: [{ id: "a2" }], hasMore: false });

    const accounts = await fetchAllAccountingAccounts();

    expect(accounts.map((account) => account.id)).toEqual(["a1", "a2"]);
    const params = callParams(0);
    expect(params.get("sortField")).toBe("code");
    expect(params.get("sortDir")).toBe("asc");
    expect(params.get("limit")).toBe("100");
    expect(params.get("includeDeleted")).toBeNull();
  });

  it("requests the trash only when asked", async () => {
    apiJsonMock.mockResolvedValueOnce({ accounts: [], hasMore: false });

    await fetchAllAccountingAccounts({ includeDeleted: true });

    expect(callParams(0).get("includeDeleted")).toBe("true");
  });
});

describe("fetchAccountingEntriesPage", () => {
  beforeEach(() => {
    apiJsonMock.mockReset();
  });

  it("sends the page, the filters and the pinned date-descending order", async () => {
    apiJsonMock.mockResolvedValueOnce({
      entries: [],
      total: 340,
      page: 2,
      limit: 100,
      hasMore: true,
    });

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

    const params = callParams(0);
    expect(params.get("page")).toBe("2");
    expect(params.get("limit")).toBe("100");
    expect(params.get("search")).toBe("INV-7");
    expect(params.get("status")).toBe("draft");
    // The tag filter is sent here because the shared ts-rest hook does not
    // forward it — otherwise the server would return an unfiltered page.
    expect(params.get("tag")).toBe("fee");
    expect(params.get("dateFrom")).toBe("2026-01-01");
    expect(params.get("dateTo")).toBe("2026-06-30");
    expect(params.get("sortField")).toBe("date");
    expect(params.get("sortDir")).toBe("desc");
    // The pager reads the server's total, not the length of the page.
    expect(page.total).toBe(340);
    expect(page.hasMore).toBe(true);
  });

  it("sends the trash flag and never asks beyond the contract page ceiling", async () => {
    apiJsonMock.mockResolvedValueOnce({ entries: [], total: 0 });

    await fetchAccountingEntriesPage({ page: 1, limit: 500, includeDeleted: true });

    expect(callParams(0).get("includeDeleted")).toBe("true");
    expect(callParams(0).get("limit")).toBe("100");
  });

  it("treats a legacy envelope without a total as a single page", async () => {
    apiJsonMock.mockResolvedValueOnce({ entries: [{ id: "e1" }] });

    const page = await fetchAccountingEntriesPage({ page: 1, limit: 100 });

    expect(page.entries.map((entry) => entry.id)).toEqual(["e1"]);
    expect(page.total).toBe(1);
    expect(page.hasMore).toBe(false);
  });
});

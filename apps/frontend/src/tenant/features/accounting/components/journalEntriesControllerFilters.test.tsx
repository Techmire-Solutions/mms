import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry } from "@/lib/data/accountingData";
import {
  EMPTY_JOURNAL_ENTRY_FILTERS,
  JOURNAL_PAGE_SIZE,
  buildJournalEntriesListQuery,
  computeJournalGrandTotals,
  useJournalEntriesListQueryState,
} from "../lib/journalEntriesControllerFilters";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("buildJournalEntriesListQuery", () => {
  it("sends every filter to the server instead of narrowing a loaded page", () => {
    const query = buildJournalEntriesListQuery(
      {
        search: "INV-7",
        statusFilter: "draft",
        tagFilter: "fee",
        dateFrom: "2026-01-01",
        dateTo: "2026-06-30",
      },
      3,
      JOURNAL_PAGE_SIZE,
      true,
    );

    expect(query).toEqual({
      page: 3,
      limit: 100,
      search: "INV-7",
      status: "draft",
      tag: "fee",
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
      // The UI has always shown date-descending; the server default is
      // `createdAt desc`, which is a different order and unstable to page through.
      sortField: "date",
      sortDir: "desc",
      includeDeleted: true,
    });
  });

  it("omits the filters the user has not set", () => {
    const query = buildJournalEntriesListQuery(
      EMPTY_JOURNAL_ENTRY_FILTERS,
      1,
      JOURNAL_PAGE_SIZE,
      false,
    );

    expect(query).toEqual({
      page: 1,
      limit: 100,
      search: undefined,
      status: undefined,
      tag: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      sortField: "date",
      sortDir: "desc",
      includeDeleted: false,
    });
  });

  it("never asks for more than the contract page ceiling", () => {
    const query = buildJournalEntriesListQuery(
      EMPTY_JOURNAL_ENTRY_FILTERS,
      1,
      JOURNAL_PAGE_SIZE,
      false,
    );
    // Asking for more than LIST_PAGE_MAX_LIMIT is a 400, not a clamp.
    expect(query.limit).toBe(100);
  });
});

describe("useJournalEntriesListQueryState", () => {
  let container: HTMLDivElement;
  let root: Root;
  let state: ReturnType<typeof useJournalEntriesListQueryState>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function Probe({ includeDeleted }: { includeDeleted: boolean }): React.JSX.Element {
    state = useJournalEntriesListQueryState(includeDeleted);
    return <div />;
  }

  function renderProbe(includeDeleted = false): void {
    act(() => {
      root.render(<Probe includeDeleted={includeDeleted} />);
    });
  }

  it("returns to page 1 when a filter changes, so page 3 of the old filter is never refetched", () => {
    renderProbe();
    act(() => state.setPage(3));
    expect(state.page).toBe(3);

    act(() => state.patchFilters({ statusFilter: "draft" }));

    expect(state.page).toBe(1);
    expect(state.filters.statusFilter).toBe("draft");
    expect(state.query.page).toBe(1);
    expect(state.query.status).toBe("draft");
  });

  it("returns to page 1 when the tag or the trash toggle changes the row set", () => {
    renderProbe();
    act(() => state.setPage(2));
    act(() => state.patchFilters({ tagFilter: "fee" }));
    expect(state.page).toBe(1);
    expect(state.query.tag).toBe("fee");

    act(() => state.setPage(2));
    renderProbe(true);
    expect(state.page).toBe(1);
    expect(state.query.includeDeleted).toBe(true);
  });

  it("debounces the search text before it reaches the query", async () => {
    vi.useFakeTimers();
    try {
      renderProbe();
      act(() => state.patchFilters({ search: "INV" }));
      // Not sent on the keystroke — only the debounced value is.
      expect(state.query.search).toBeUndefined();

      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(state.query.search).toBe("INV");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("computeJournalGrandTotals", () => {
  const entry = (id: string, debit: number, credit: number): JournalEntry => ({
    id,
    ref: id,
    date: "2026-01-01",
    description: id,
    status: "posted",
    created_by: "u1",
    fiscal_year: "2026",
    tags: [],
    attachments: [],
    lines: [
      { id: `${id}-d`, account_id: "a-cash", debit, credit: 0, description: "" },
      { id: `${id}-c`, account_id: "a-fees", debit: 0, credit, description: "" },
    ],
  });

  it("sums the rows on the page in integer cents", () => {
    const totals = computeJournalGrandTotals([entry("e1", 0.1, 0.1), entry("e2", 0.2, 0.2)]);
    expect(String(totals.grandDebit)).toBe("0.3");
    expect(String(totals.grandCredit)).toBe("0.3");
  });
});

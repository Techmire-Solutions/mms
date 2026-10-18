import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_TRANSLATIONS_EN } from "@mms/shared";
import type { JournalEntry } from "@/lib/data/accountingData";
import { JournalEntriesList } from "./JournalEntriesList";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The real ListPagination builds its keys from the namespace
 * (`accounting.pagination.*`), so this test resolves them from the shipped
 * English pack: a missing key would render the key itself and fail here.
 */
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    language: "en",
    direction: "ltr",
    t: (key: string, params?: Record<string, string | number>) => {
      const template = (APP_TRANSLATIONS_EN as Record<string, string>)[key] ?? key;
      return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params?.[name] ?? ""));
    },
  }),
}));

vi.mock("@/tenant/features/accounting/components/JournalEntriesListCards", () => ({
  JournalEntriesListCards: () => <div data-testid="journal-cards" />,
}));
vi.mock("@/tenant/features/accounting/components/JournalEntriesListDesktopTable", () => ({
  JournalEntriesListDesktopTable: () => <div data-testid="journal-table" />,
}));

const entry = (id: string): JournalEntry => ({
  id,
  ref: id,
  date: "2026-01-01",
  description: id,
  status: "posted",
  created_by: "u1",
  fiscal_year: "2026",
  tags: [],
  attachments: [],
  lines: [{ id: `${id}-d`, account_id: "a-cash", debit: 10, credit: 0, description: "" }],
});

const baseProps = {
  entries: [entry("e1"), entry("e2")],
  selectedIds: [],
  canDelete: false,
  allVisibleSelected: false,
  someVisibleSelected: false,
  isColumnVisible: () => true,
  journalStatusConfig: {},
  grandDebit: 20,
  grandCredit: 0,
  formatAmount: (amount: number) => String(amount),
  renderEntryActions: () => null,
  renderEntryActionsCards: () => null,
  onView: () => {},
  onToggleSelectedEntry: () => {},
  onToggleSelectAll: () => {},
};

describe("JournalEntriesList pager", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function renderList(overrides: Record<string, unknown> = {}): void {
    act(() => {
      root.render(
        <JournalEntriesList
          {...baseProps}
          viewMode="table"
          page={1}
          limit={100}
          total={340}
          hasMore
          onPageChange={() => {}}
          {...overrides}
        />,
      );
    });
  }

  it("renders the server total and page count under the desktop table", () => {
    renderList();
    expect(container.querySelector('[data-testid="journal-table"]')).not.toBeNull();
    const nav = container.querySelector('[role="navigation"]');
    expect(nav?.textContent).toContain("1–100 of 340");
    expect(nav?.textContent).toContain("Page 1 of 4");
    // The namespace-built aria-label must resolve too.
    expect(nav?.getAttribute("aria-label")).toBe("Pagination");
  });

  it("renders the same pager under the mobile cards", () => {
    renderList({ viewMode: "cards" });
    expect(container.querySelector('[data-testid="journal-cards"]')).not.toBeNull();
    expect(container.querySelector('[role="navigation"]')?.textContent).toContain("1–100 of 340");
  });

  it("reports the requested page through onPageChange", () => {
    const onPageChange = vi.fn();
    renderList({ page: 2, onPageChange });

    expect(container.querySelector('[role="navigation"]')?.textContent).toContain("101–200 of 340");

    const next = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Next"),
    );
    expect(next).toBeDefined();
    act(() => next?.click());

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("disables the previous button on the first page", () => {
    renderList();
    const previous = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Previous"),
    );
    expect(previous?.disabled).toBe(true);
  });

  it("still allows paging back when the loaded page is empty", () => {
    // A page can empty out (rows trashed elsewhere); the pager has to stay.
    const onPageChange = vi.fn();
    renderList({ entries: [], page: 4, onPageChange });

    const previous = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Previous"),
    );
    act(() => previous?.click());

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("shows no pager when the filter matches nothing at all", () => {
    renderList({ entries: [], total: 0, hasMore: false });
    expect(container.querySelector('[role="navigation"]')).toBeNull();
  });
});

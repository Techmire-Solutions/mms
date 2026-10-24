import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJournalEntriesController } from "./useJournalEntriesController";
import type { JournalEntry } from "@/lib/data/accountingData";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useAccountingCurrency: () => ({
    activeCurrency: { symbol: "$", code: "USD" },
    formatCurrency: (amount: number | string | null | undefined) => `$${amount ?? "—"}`,
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/lib/backgroundJobs/runGridCsvExportJob", () => ({
  runGridCsvExportJob: vi.fn(),
}));

vi.mock("@/tenant/features/accounting/hooks/useReverseJournalEntry", () => ({
  useReverseJournalEntry: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/tenant/features/accounting/hooks/usePaymentVoucherPrint", () => ({
  usePaymentVoucherPrint: () => vi.fn(),
}));

const mockEntries: JournalEntry[] = [
  {
    id: "entry-1",
    ref: "JE-001",
    date: "2026-09-01",
    description: "Entry 1",
    status: "draft",
    created_by: "u1",
    fiscal_year: "2026",
    tags: ["Fees"],
    attachments: [],
    lines: [
      { id: "l1", account_id: "a1000", debit: 100, credit: 0, description: "" },
      { id: "l2", account_id: "a4000", debit: 0, credit: 100, description: "" },
    ],
  },
];

describe("useJournalEntriesController", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useJournalEntriesController> | null = null;

  beforeEach(() => {
    latest = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  function Probe({ props }: { props: Parameters<typeof useJournalEntriesController>[0] }) {
    latest = useJournalEntriesController(props);
    return (
      <div>
        <span data-testid="mode">{latest.mode}</span>
        <span data-testid="tab">{latest.tab}</span>
        <span data-testid="modal">{latest.modal ?? "none"}</span>
      </div>
    );
  }

  const defaultProps = {
    entries: mockEntries,
    accounts: [],
    settings: {} as unknown as never,
    fiscalYears: [],
    onChange: vi.fn(),
    onFilteredCountChange: vi.fn(),
    filters: {
      search: "",
      statusFilter: "",
      tagFilter: "",
      dateFrom: "",
      dateTo: "",
    },
    onFiltersChange: vi.fn(),
    paging: {
      page: 1,
      limit: 25,
      total: 1,
      hasMore: false,
      onPageChange: vi.fn(),
    },
  };

  it("initializes with simple mode and reports total count", async () => {
    const onFilteredCountChange = vi.fn();

    await act(async () => {
      root.render(<Probe props={{ ...defaultProps, onFilteredCountChange }} />);
    });

    expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("simple");
    expect(container.querySelector('[data-testid="tab"]')?.textContent).toBe("transactions");
    expect(onFilteredCountChange).toHaveBeenCalledWith(1);
    expect(latest?.grandDebit).toBe(100);
    expect(latest?.grandCredit).toBe(100);
  });

  it("switches to advanced mode when showDeleted is true", async () => {
    await act(async () => {
      root.render(<Probe props={{ ...defaultProps, showDeleted: true }} />);
    });

    expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("advanced");
  });

  it("switches to advanced mode and opens new modal when createRequestKey is incremented", async () => {
    await act(async () => {
      root.render(<Probe props={{ ...defaultProps, createRequestKey: 1 }} />);
    });

    expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("advanced");
    expect(container.querySelector('[data-testid="modal"]')?.textContent).toBe("new");
  });

  it("updates mode and tab via controller setters", async () => {
    await act(async () => {
      root.render(<Probe props={defaultProps} />);
    });

    await act(async () => {
      latest?.setMode("advanced");
      latest?.setTab("cashbook");
    });

    expect(container.querySelector('[data-testid="mode"]')?.textContent).toBe("advanced");
    expect(container.querySelector('[data-testid="tab"]')?.textContent).toBe("cashbook");
  });

  it("toggles and clears entry selection", async () => {
    const onShortcutStateChange = vi.fn();
    await act(async () => {
      root.render(<Probe props={{ ...defaultProps, onShortcutStateChange }} />);
    });

    expect(latest?.selectedIds).toHaveLength(0);
    expect(onShortcutStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: "simple",
        selectedCount: 0,
        clearSelection: expect.any(Function),
      }),
    );

    await act(async () => {
      latest?.toggleSelected("entry-1", true);
    });
    expect(latest?.selectedIds).toContain("entry-1");
    expect(onShortcutStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedCount: 1,
      }),
    );

    await act(async () => {
      latest?.clearSelection();
    });
    expect(latest?.selectedIds).toHaveLength(0);
  });
});

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JournalQuickActionsPanel } from "./JournalQuickActionsPanel";
import type { JournalEntry } from "@/lib/data/accountingData";
import { QUICK_ACTIONS } from "../lib/journalEntriesQuickActions";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params?.label ? `${key}:${params.label}` : key,
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useAccountingCurrency: () => ({
    activeCurrency: { symbol: "$", code: "USD" },
    formatCurrency: (amount: number | string | null | undefined) => `$${amount ?? "—"}`,
  }),
}));

vi.mock("@/components/app/StatusBadge", () => ({
  StatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

const mockEntries: JournalEntry[] = [
  {
    id: "entry-in",
    ref: "JE-001",
    date: "2026-09-01",
    description: "Fee payment",
    status: "posted",
    created_by: "u1",
    fiscal_year: "2026",
    tags: ["Fees"],
    attachments: [],
    lines: [
      { id: "l1", account_id: "a1000", debit: 300, credit: 0, description: "" },
      { id: "l2", account_id: "a4000", debit: 0, credit: 300, description: "" },
    ],
  },
  {
    id: "entry-out",
    ref: "JE-002",
    date: "2026-09-02",
    description: "Salary disbursement",
    status: "draft",
    created_by: "u1",
    fiscal_year: "2026",
    tags: ["Payroll"],
    attachments: [],
    lines: [
      { id: "l3", account_id: "a5000", debit: 500, credit: 0, description: "" },
      { id: "l4", account_id: "a1010", debit: 0, credit: 500, description: "" },
    ],
  },
];

describe("JournalQuickActionsPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it("renders natural language input and handles changes and submission", async () => {
    const onNlSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onNlChange = vi.fn();
    const onOpenPrefill = vi.fn();
    const onExportCsv = vi.fn();

    await act(async () => {
      root.render(
        <JournalQuickActionsPanel
          entries={mockEntries}
          canWrite={true}
          nlInput="collect fee 500"
          nlSuggestion={QUICK_ACTIONS[0]!.type}
          onNlSubmit={onNlSubmit}
          onNlChange={onNlChange}
          onOpenPrefill={onOpenPrefill}
          onExportCsv={onExportCsv}
          pageScopeLabel="Current page: 2 of 20"
        />,
      );
    });

    const input = container.querySelector("#nl-input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("collect fee 500");

    // Check suggestion pill
    expect(container.querySelector('[role="status"]')).not.toBeNull();

    // Trigger change
    await act(async () => {
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // Submit form
    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onNlSubmit).toHaveBeenCalled();
  });

  it("renders quick action buttons and fires onOpenPrefill", async () => {
    const onOpenPrefill = vi.fn();

    await act(async () => {
      root.render(
        <JournalQuickActionsPanel
          entries={mockEntries}
          canWrite={true}
          nlInput=""
          nlSuggestion={null}
          onNlSubmit={vi.fn()}
          onNlChange={vi.fn()}
          onOpenPrefill={onOpenPrefill}
          onExportCsv={vi.fn()}
          pageScopeLabel="Current page: 2 of 20"
        />,
      );
    });

    const buttons = container.querySelectorAll(
      'section[aria-label="accounting.journal.dashboard.quickActions"] button',
    );
    expect(buttons.length).toBe(QUICK_ACTIONS.length + 1);

    // Click the first quick action (e.g. Fee Collection)
    await act(async () => {
      (buttons[0] as HTMLButtonElement).click();
    });
    expect(onOpenPrefill).toHaveBeenCalledWith(QUICK_ACTIONS[0]!.type);

    // Click the dashed "Other Transaction" button
    await act(async () => {
      (buttons[buttons.length - 1] as HTMLButtonElement).click();
    });
    expect(onOpenPrefill).toHaveBeenCalledWith(null);
  });

  it("renders recent entries with correct cash flow signs and colors", async () => {
    await act(async () => {
      root.render(
        <JournalQuickActionsPanel
          entries={mockEntries}
          canWrite={true}
          nlInput=""
          nlSuggestion={null}
          onNlSubmit={vi.fn()}
          onNlChange={vi.fn()}
          onOpenPrefill={vi.fn()}
          onExportCsv={vi.fn()}
          pageScopeLabel="Current page: 2 of 20"
        />,
      );
    });

    expect(container.textContent).toContain("Fee payment");
    expect(container.textContent).toContain("Salary disbursement");
    expect(container.textContent).toContain("+$300");
    expect(container.textContent).toContain("−$500");
  });

  it("renders empty state when there are no entries", async () => {
    await act(async () => {
      root.render(
        <JournalQuickActionsPanel
          entries={[]}
          canWrite={true}
          nlInput=""
          nlSuggestion={null}
          onNlSubmit={vi.fn()}
          onNlChange={vi.fn()}
          onOpenPrefill={vi.fn()}
          onExportCsv={vi.fn()}
          pageScopeLabel="Current page: 0 of 0"
        />,
      );
    });

    expect(container.textContent).toContain("accounting.journal.dashboard.noTransactionsYet");
  });

  it("calls onExportCsv when export button is clicked", async () => {
    const onExportCsv = vi.fn();

    await act(async () => {
      root.render(
        <JournalQuickActionsPanel
          entries={mockEntries}
          canWrite={true}
          nlInput=""
          nlSuggestion={null}
          onNlSubmit={vi.fn()}
          onNlChange={vi.fn()}
          onOpenPrefill={vi.fn()}
          onExportCsv={onExportCsv}
          pageScopeLabel="Current page: 2 of 20"
        />,
      );
    });

    const exportBtn = container.querySelector(
      'section[aria-label="accounting.journal.dashboard.recentTransactions"] button',
    ) as HTMLButtonElement;
    expect(exportBtn).not.toBeNull();

    await act(async () => {
      exportBtn.click();
    });
    expect(onExportCsv).toHaveBeenCalled();
    expect(container.textContent).toContain("Current page: 2 of 20");
  });
});

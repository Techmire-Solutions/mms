import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JournalEntriesListCards } from "./JournalEntriesListCards";
import type { JournalEntry } from "@/lib/data/accountingData";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { ref?: string | number; count?: string | number }) => {
      if (params?.ref) return `${key}:${params.ref}`;
      if (params?.count) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

const mockEntry: JournalEntry = {
  id: "je-1",
  ref: "JE-2025-001",
  date: "2025-01-01",
  description: "Monthly School Supplies Purchase",
  status: "posted",
  tags: ["tuition"],
  lines: [
    { id: "l-1", account_id: "acc-1", debit: 500, credit: 0, description: "Office Supplies" },
    { id: "l-2", account_id: "acc-2", debit: 0, credit: 500, description: "Bank Account" },
  ],
  created_by: "user-1",
  fiscal_year: "2025",
  attachments: [],
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
} as unknown as JournalEntry;

const mockStatusConfig = {
  posted: { label: "Posted", cls: "bg-success text-success" },
  draft: { label: "Draft", cls: "bg-warning text-warning" },
};

describe("JournalEntriesListCards Component", () => {
  it("renders journal entry card with description, ref, debit, and credit metadata", () => {
    const html = renderToStaticMarkup(
      <JournalEntriesListCards
        entries={[mockEntry]}
        selectedIds={[]}
        canDelete={true}
        allVisibleSelected={false}
        someVisibleSelected={false}
        isColumnVisible={() => true}
        journalStatusConfig={mockStatusConfig}
        grandDebit={500}
        grandCredit={500}
        formatAmount={(n) => `$${n}`}
        renderEntryActionsCards={() => <button type="button">Actions</button>}
        onToggleSelectedEntry={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(html).toContain("Monthly School Supplies Purchase");
    expect(html).toContain("JE-2025-001");
    expect(html).toContain("$500");
    expect(html).toContain("accounting.columns.journal.date");
  });

  it("handles empty entries list", () => {
    const html = renderToStaticMarkup(
      <JournalEntriesListCards
        entries={[]}
        selectedIds={[]}
        canDelete={true}
        allVisibleSelected={false}
        someVisibleSelected={false}
        isColumnVisible={() => true}
        journalStatusConfig={mockStatusConfig}
        grandDebit={0}
        grandCredit={0}
        formatAmount={(n) => `$${n}`}
        renderEntryActionsCards={() => null}
        onToggleSelectedEntry={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(html).toContain("accounting.item.entries");
  });

  it("renders selected state properly", () => {
    const html = renderToStaticMarkup(
      <JournalEntriesListCards
        entries={[mockEntry]}
        selectedIds={["je-1"]}
        canDelete={true}
        allVisibleSelected={true}
        someVisibleSelected={false}
        isColumnVisible={() => true}
        journalStatusConfig={mockStatusConfig}
        grandDebit={500}
        grandCredit={500}
        formatAmount={(n) => `$${n}`}
        renderEntryActionsCards={() => null}
        onToggleSelectedEntry={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(html).toContain('data-selected="true"');
  });
});

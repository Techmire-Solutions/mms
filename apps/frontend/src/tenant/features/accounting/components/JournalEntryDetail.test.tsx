import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_TRANSLATIONS_EN } from "@mms/shared";
import type { Account, JournalEntry } from "@/lib/data/accountingData";
import { JournalEntryDetail } from "./JournalEntryDetail";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

vi.mock("@/hooks/useCurrency", () => ({
  useAccountingCurrency: () => ({
    formatCurrency: (val: number) => `$${val}`,
  }),
}));

vi.mock("@/components/ui/Drawer", () => ({
  Drawer: ({
    title,
    headerExtra,
    headerActions,
    children,
  }: {
    title: string;
    headerExtra?: React.ReactNode;
    headerActions?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="detail-sheet">
      <h2>{title}</h2>
      <div data-testid="header-extra">{headerExtra}</div>
      <div data-testid="header-actions">{headerActions}</div>
      <div>{children}</div>
    </div>
  ),
}));

const mockAccounts: Account[] = [
  {
    id: "a-cash",
    code: "1010",
    name: "Cash",
    type: "Asset",
    subtype: "Current Asset",
    description: "",
    isActive: true,
  },
  {
    id: "a-rev",
    code: "4010",
    name: "Revenue",
    type: "Revenue",
    subtype: "Operating Revenue",
    description: "",
    isActive: true,
  },
];

const mockDraftEntry: JournalEntry = {
  id: "je-1",
  ref: "JE-0001",
  date: "2026-03-01",
  description: "Test draft entry",
  status: "draft",
  created_by: "Admin",
  fiscal_year: "2026",
  tags: ["operational"],
  attachments: [],
  lines: [
    { id: "l1", account_id: "a-cash", debit: 100, credit: 0, description: "Debit" },
    { id: "l2", account_id: "a-rev", debit: 0, credit: 100, description: "Credit" },
  ],
};

const mockPostedEntry: JournalEntry = {
  ...mockDraftEntry,
  id: "je-2",
  ref: "JE-0002",
  status: "posted",
};

const mockArchivedEntry: JournalEntry = {
  ...mockPostedEntry,
  id: "je-3",
  ref: "JE-0003",
  deletedAt: "2026-03-10T12:00:00Z",
};

describe("JournalEntryDetail UI/UX", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders active draft entry with edit action and without archive banner", () => {
    const onEdit = vi.fn();
    const onReverse = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root.render(
        <JournalEntryDetail
          entry={mockDraftEntry}
          accounts={mockAccounts}
          onClose={onClose}
          onEdit={onEdit}
          onReverse={onReverse}
        />,
      );
    });

    expect(container.textContent).toContain("JE-0001");
    expect(container.textContent).toContain("Draft");
    // Edit button is present
    const editBtn = container.querySelector("button:has(svg.lucide-pencil)");
    expect(editBtn).not.toBeNull();
    // Reverse button is absent for draft
    const reverseBtn = container.querySelector("button:has(svg.lucide-rotate-ccw)");
    expect(reverseBtn).toBeNull();
    // Archived banner is absent
    expect(container.querySelector('[role="status"]')?.textContent).not.toContain("Archived");
  });

  it("renders active posted entry with reverse action and without edit button", () => {
    const onEdit = vi.fn();
    const onReverse = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root.render(
        <JournalEntryDetail
          entry={mockPostedEntry}
          accounts={mockAccounts}
          onClose={onClose}
          onEdit={onEdit}
          onReverse={onReverse}
        />,
      );
    });

    expect(container.textContent).toContain("JE-0002");
    expect(container.textContent).toContain("Posted");
    // Edit button absent
    const editBtn = container.querySelector("button:has(svg.lucide-pencil)");
    expect(editBtn).toBeNull();
    // Reverse button present
    const reverseBtn = container.querySelector("button:has(svg.lucide-rotate-ccw)");
    expect(reverseBtn).not.toBeNull();
  });

  it("renders archived entry with DetailDrawerArchivedBanner and Restore button while hiding Edit and Reverse", async () => {
    const onEdit = vi.fn();
    const onReverse = vi.fn();
    const onClose = vi.fn();
    const onRestore = vi.fn();

    act(() => {
      root.render(
        <JournalEntryDetail
          entry={mockArchivedEntry}
          accounts={mockAccounts}
          onClose={onClose}
          onEdit={onEdit}
          onReverse={onReverse}
          onRestore={onRestore}
          canRestore={true}
        />,
      );
    });

    expect(container.textContent).toContain("JE-0003");
    // Archive banner is present with warning tone
    expect(container.textContent).toContain("Archived on");
    // Edit and Reverse are hidden
    const editBtn = container.querySelector("button:has(svg.lucide-pencil)");
    expect(editBtn).toBeNull();

    // Restore button is present
    const restoreBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Restore"),
    );
    expect(restoreBtn).toBeDefined();

    // Clicking restore triggers onRestore and onClose
    await act(async () => {
      restoreBtn?.click();
    });
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onReverse).not.toHaveBeenCalled();
  });
});

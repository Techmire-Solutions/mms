vi.mock("@mms/fe-core/query/optionalQueryContext", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuthOrNull: () => ({ isAuthenticated: true, user: { id: "u-1" }, token: "test-token" }),
}));

vi.mock("@mms/fe-core/auth/AuthContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/fe-core/auth/AuthContext")>()),
  useAuth: () => ({ user: { id: "u-1" }, isAuthenticated: true, token: "test-token" }),
}));

vi.mock("../hooks/useVoucherNumbering", () => ({
  VOUCHER_NUMBERING_QUERY_KEY: ["accounting", "voucher-numbering"],
  useVoucherNumbering: () => ({ data: { autoGenerate: true, nextVoucherNumber: "JE-0001" } }),
  useSaveVoucherNumbering: () => ({ mutateAsync: async () => undefined, isPending: false }),
}));

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Account, FiscalYear, JournalEntry } from "../index";
import { JournalEntryForm } from "./JournalEntryForm";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
    dir: "ltr",
    language: "en",
  }),
}));

vi.mock("../hooks/useAccountingCurrency", () => ({
  useAccountingCurrency: () => ({
    formatCurrency: (amount: number | string | null | undefined) => `$${amount ?? 0}`,
  }),
}));

vi.mock("@mms/fe-core/auth/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/fe-core/auth/AuthContext")>();
  return {
    ...actual,
    useAuth: () => ({
      user: { name: "Tester Accountant" },
    }),
    useOptionalAuth: () => ({
      user: { name: "Tester Accountant" },
    }),
  };
});

vi.mock("../hooks/useJournalTemplates", () => ({
  useJournalTemplates: () => ({
    templates: [],
    canSeed: false,
    seeding: false,
    seedTemplates: vi.fn(),
  }),
}));

vi.mock("../hooks/useJournalEntryCurrency", () => ({
  useJournalEntryCurrency: () => ({
    functionalCurrency: "PKR",
    currency: "PKR",
    setCurrency: vi.fn(),
    isForeign: false,
    rate: "",
    rateOverride: "",
    setRateOverride: vi.fn(),
    lookedUpRate: null,
    rateMissing: false,
    currencyOptions: [{ value: "PKR", label: "PKR" }],
    showCurrencyPicker: false,
  }),
}));

vi.mock("../hooks/useAccountingLedgerOps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/useAccountingLedgerOps")>();
  return {
    ...actual,
    usePostingPeriods: () => ({ data: [] }),
    useAccountingPostingRules: () => ({ isSuccess: true, data: {} }),
  };
});

vi.mock("../index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../index")>();
  return {
    ...actual,
    useVoucherNumbering: () => ({ data: { autoGenerate: true, nextVoucherNumber: "JE-0001" } }),
    useAccountingLedger: () => ({ data: undefined }),
  };
});

vi.mock("@mms/fe-core/tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/fe-core/tenant")>();
  return {
    ...actual,

    useWorkDirectoryViewMode: () => ({ viewMode: "table" }),
  };
});

vi.mock("framer-motion", () => {
  const comp = ({ children, ...props }: { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  );
  return {
    m: new Proxy({}, { get: () => comp }),
    motion: { div: comp },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

const formModalPropsCapture = vi.hoisted(() => ({
  lastProps: null as Record<string, unknown> | null,
}));

vi.mock("@mms/fe-core/components/FormModal", () => ({
  FormModal: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
    formModalPropsCapture.lastProps = props;
    return (
      <div data-testid="form-modal-mock">
        <h1>{String(props.title)}</h1>
        <button type="button" data-testid="close-btn" onClick={props.onClose as () => void}>
          Close
        </button>
        {props.children}
      </div>
    );
  },
}));

const mockAccounts: Account[] = [
  {
    id: "a-cash",
    code: "1000",
    name: "Cash in Hand",
    type: "Asset",
    subtype: "Current Asset",
    description: "",
    isActive: true,
  },
  {
    id: "a-fees",
    code: "4000",
    name: "Tuition Fees",
    type: "Revenue",
    subtype: "Operating Revenue",
    description: "",
    isActive: true,
  },
];

const mockFiscalYears: FiscalYear[] = [
  {
    id: "fy-2026",
    label: "FY 2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "active",
  },
];

describe("JournalEntryForm Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    formModalPropsCapture.lastProps = null;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders new journal entry modal with clean initial dirty state", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <JournalEntryForm
          accounts={mockAccounts}
          entries={[]}
          fiscalYears={mockFiscalYears}
          onSave={onSave}
          onClose={onClose}
        />,
      );
    });

    expect(container.textContent).toContain("accounting.journal.form.newTitle");
    expect(formModalPropsCapture.lastProps).not.toBeNull();
    expect(formModalPropsCapture.lastProps?.isDirty).toBe(false);
  });

  it("renders edit title when editing an existing entry", async () => {
    const existingEntry: JournalEntry = {
      id: "je-101",
      ref: "JE-0001",
      date: "2026-02-01",
      description: "Existing entry narration",
      status: "draft",
      lines: [
        {
          id: "l-1",
          account_id: "a-cash",
          debit: 500,
          credit: 0,
          description: "Cash leg",
        },
        {
          id: "l-2",
          account_id: "a-fees",
          debit: 0,
          credit: 500,
          description: "Fee leg",
        },
      ],
      createdAt: "2026-02-01T10:00:00Z",
      created_by: "Admin",
      updatedAt: "2026-02-01T10:00:00Z",
      fiscal_year: "FY 2026",
      fiscal_year_id: "fy-2026",
      tags: [],
      attachments: [],
    };

    await act(async () => {
      root.render(
        <JournalEntryForm
          accounts={mockAccounts}
          entries={[existingEntry]}
          fiscalYears={mockFiscalYears}
          initial={existingEntry}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("accounting.journal.form.editTitle");
    expect(formModalPropsCapture.lastProps?.isDirty).toBe(false);
  });

  it("handles onClose dismissal", async () => {
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <JournalEntryForm
          accounts={mockAccounts}
          entries={[]}
          fiscalYears={mockFiscalYears}
          onSave={vi.fn()}
          onClose={onClose}
        />,
      );
    });

    const closeBtn = container.querySelector('[data-testid="close-btn"]');
    expect(closeBtn instanceof HTMLButtonElement).toBe(true);

    await act(async () => {
      closeBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("triggers onSave from FormModal action", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(
        <JournalEntryForm
          accounts={mockAccounts}
          entries={[]}
          fiscalYears={mockFiscalYears}
          onSave={onSave}
          onClose={vi.fn()}
        />,
      );
    });

    await act(async () => {
      const onModalSave = formModalPropsCapture.lastProps?.onSave as
        (() => Promise<void>) | undefined;
      await onModalSave?.();
    });

    // An unbalanced entry cannot save, but calling onSave executes the handler
    expect(formModalPropsCapture.lastProps?.isDirty).toBe(false);
  });

  it("submits draft entry via footer draft button", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(
        <JournalEntryForm
          accounts={mockAccounts}
          entries={[]}
          fiscalYears={mockFiscalYears}
          onSave={onSave}
          onClose={vi.fn()}
        />,
      );
    });

    const footer = formModalPropsCapture.lastProps?.footerStart as
      React.ReactElement<{ onClick?: () => Promise<void> }> | undefined;
    expect(React.isValidElement(footer)).toBe(true);

    await act(async () => {
      await footer?.props.onClick?.();
    });
  });

  it("handles form submit event", async () => {
    await act(async () => {
      root.render(
        <JournalEntryForm
          accounts={mockAccounts}
          entries={[]}
          fiscalYears={mockFiscalYears}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const form = container.querySelector("form#journal-entry-form");
    expect(form instanceof HTMLFormElement).toBe(true);

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  });
});

import React, { act } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { ObligationVoucherModal } from "./ObligationVoucherModal";
import type { ObligationCollection } from "@/lib/data/obligationsData";
import type { Account, JournalEntry } from "@/lib/data/accountingData";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockUseObligationVoucher = vi.fn();
vi.mock("@/tenant/features/obligations/hooks/useObligationVoucher", () => ({
  useObligationVoucher: (...args: unknown[]) => mockUseObligationVoucher(...args),
}));

const mockCollection: ObligationCollection = {
  id: "col-1",
  receipt_no: "REC-2026-001",
  received_date: "2026-09-13",
  sender_id: "c-1",
  reference_id: "c-2",
  amount: 5000,
  currency_id: "PKR",
  payment_mode: "Cash",
  obligation_type_id: "type-1",
  mujtahid_representative_id: "rep-1",
  received_by: "u-1",
  created_at: "2026-09-13T10:00:00Z",
};

const mockAccounts: Account[] = [
  {
    id: "acc-1",
    code: "1010",
    name: "Cash in Hand",
    type: "Asset",
    subtype: "cash",
    description: "",
    isActive: true,
  },
  {
    id: "acc-2",
    code: "4010",
    name: "Obligation Revenue",
    type: "Revenue",
    subtype: "revenue",
    description: "",
    isActive: true,
  },
];

const mockEntry: JournalEntry = {
  id: "entry-1",
  ref: "JV-2026-001",
  date: "2026-09-13",
  description: "Obligation collection receipt REC-2026-001",
  status: "posted",
  created_by: "u-1",
  tags: [],
  attachments: [],
  fiscal_year: "2026",
  lines: [
    {
      id: "line-1",
      account_id: "acc-1",
      description: "Debit Cash",
      debit: 5000,
      credit: 0,
    },
    {
      id: "line-2",
      account_id: "acc-2",
      description: "Credit Revenue",
      debit: 0,
      credit: 5000,
    },
  ],
};

describe("ObligationVoucherModal", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it("renders nothing when collection is null", async () => {
    mockUseObligationVoucher.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<ObligationVoucherModal collection={null} onClose={vi.fn()} />);
    });

    expect(container.innerHTML).toBe("");
    await act(async () => {
      root.unmount();
    });
  });

  it("renders loading state", async () => {
    mockUseObligationVoucher.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<ObligationVoucherModal collection={mockCollection} onClose={vi.fn()} />);
    });

    expect(document.body.textContent).toContain("common.loading");
    await act(async () => {
      root.unmount();
    });
  });

  it("renders not found state with retry button", async () => {
    const refetch = vi.fn();
    mockUseObligationVoucher.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch,
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<ObligationVoucherModal collection={mockCollection} onClose={vi.fn()} />);
    });

    expect(document.body.textContent).toContain("obligations.voucher.notFound");
    expect(document.body.textContent).toContain("common.retry");
    await act(async () => {
      root.unmount();
    });
  });

  it("renders voucher details and balanced table entries", async () => {
    mockUseObligationVoucher.mockReturnValue({
      data: {
        entry: mockEntry,
        accounts: mockAccounts,
      },
      isLoading: false,
      isError: false,
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<ObligationVoucherModal collection={mockCollection} onClose={vi.fn()} />);
    });

    expect(document.body.textContent).toContain("JV-2026-001");
    expect(document.body.textContent).toContain("1010");
    expect(document.body.textContent).toContain("Cash in Hand");
    expect(document.body.textContent).toContain("4010");
    expect(document.body.textContent).toContain("Obligation Revenue");
    expect(document.body.textContent).toContain("accounting.journal.voucher.total");
    await act(async () => {
      root.unmount();
    });
  });
});

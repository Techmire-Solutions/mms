import React, { act } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { ObligationCollectionDetail } from "./ObligationCollectionDetail";
import type {
  ObligationCollection,
  ObligationType,
  MujtahidRep,
  Mujtahid,
  WakalaType,
  ObligationDistribution,
} from "@/lib/data/obligationsData";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/obligations/hooks/useObligationLookups", () => ({
  useMergedObligationContacts: (_ids: (string | number | null | undefined)[]) => [
    { id: "c-1", name: "Muhammad Ali" },
    { id: "c-2", name: "Sayyid Kazim" },
  ],
  useMergedObligationUsers: () => [{ id: "u-1", name: "Admin Clerk" }],
}));

vi.mock("@/tenant/features/obligations/components/invoice/PrintInvoiceModal", () => ({
  PrintInvoiceModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="print-invoice-modal">
      <button type="button" onClick={onClose}>
        Close Print
      </button>
    </div>
  ),
}));

const mockCollection: ObligationCollection = {
  id: "col-1",
  receipt_no: "REC-2026-001",
  received_date: "2026-09-13",
  sender_id: "c-1",
  reference_id: "c-2",
  amount: 1000,
  currency_id: "USD",
  payment_mode: "Cash",
  obligation_type_id: "ot-1",
  mujtahid_representative_id: "rep-1",
  received_by: "u-1",
  created_at: "2026-09-13T10:00:00Z",
  updated_at: "2026-09-13T10:00:00Z",
};

const mockObligationTypes: ObligationType[] = [
  {
    id: "ot-1",
    name: "Khums (Sahm-e-Imam)",
    quantity_based: false,
    designated_for: "Both",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const mockMujtahids: Mujtahid[] = [
  {
    id: "m-1",
    name: "Ayatullah Sistani",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const mockReps: MujtahidRep[] = [
  {
    id: "rep-1",
    name: "Maulana Baqir",
    mujtahid_id: "m-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const mockWakalaTypes: WakalaType[] = [
  {
    id: "wt-1",
    obligation_type_id: "ot-1",
    mujtahid_representative_id: "rep-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const mockDistributions: ObligationDistribution[] = [
  {
    id: "dist-1",
    wakala_type_id: "wt-1",
    name: "Local Welfare",
    percentage: 50,
    type: "Income",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "dist-2",
    wakala_type_id: "wt-1",
    name: "Central Seminary",
    percentage: 50,
    type: "Liability",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

describe("ObligationCollectionDetail Component", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    return () => {
      if (container) {
        container.remove();
        container = null;
      }
    };
  });

  it("renders receipt header, attribute rows, and resolved relational entities", async () => {
    const root = createRoot(container!);

    await act(async () => {
      root.render(
        <ObligationCollectionDetail
          collection={mockCollection}
          obligationTypes={mockObligationTypes}
          reps={mockReps}
          mujtahids={mockMujtahids}
          distributions={mockDistributions}
          wakalaTypes={mockWakalaTypes}
          onClose={vi.fn()}
        />,
      );
    });

    expect(document.body.textContent).toContain("REC-2026-001");
    expect(document.body.textContent).toContain("Muhammad Ali");
    expect(document.body.textContent).toContain("Sayyid Kazim");
    expect(document.body.textContent).toContain("Khums (Sahm-e-Imam)");
    expect(document.body.textContent).toContain("Maulana Baqir");
    expect(document.body.textContent).toContain("Ayatullah Sistani");
    expect(document.body.textContent).toContain("Admin Clerk");
  });

  it("renders distribution breakdown and calculates total percentage and amount in footer", async () => {
    const root = createRoot(container!);

    await act(async () => {
      root.render(
        <ObligationCollectionDetail
          collection={mockCollection}
          obligationTypes={mockObligationTypes}
          reps={mockReps}
          mujtahids={mockMujtahids}
          distributions={mockDistributions}
          wakalaTypes={mockWakalaTypes}
          onClose={vi.fn()}
        />,
      );
    });

    expect(document.body.textContent).toContain("Local Welfare");
    expect(document.body.textContent).toContain("Central Seminary");
    expect(document.body.textContent).toContain("reports.fields.total");
    expect(document.body.textContent).toContain("100%");
  });

  it("displays warning callout when wakala type has zero distributions configured", async () => {
    const root = createRoot(container!);

    await act(async () => {
      root.render(
        <ObligationCollectionDetail
          collection={mockCollection}
          obligationTypes={mockObligationTypes}
          reps={mockReps}
          mujtahids={mockMujtahids}
          distributions={[]}
          wakalaTypes={mockWakalaTypes}
          onClose={vi.fn()}
        />,
      );
    });

    expect(document.body.textContent).toContain("obligations.detail.noDistribution");
  });

  it("handles archived collection banner and triggers restore callback", async () => {
    const onRestore = vi.fn();
    const archivedCollection: ObligationCollection = {
      ...mockCollection,
      deletedAt: "2026-09-13T12:00:00Z",
    };

    const root = createRoot(container!);

    await act(async () => {
      root.render(
        <ObligationCollectionDetail
          collection={archivedCollection}
          obligationTypes={mockObligationTypes}
          reps={mockReps}
          mujtahids={mockMujtahids}
          distributions={mockDistributions}
          wakalaTypes={mockWakalaTypes}
          onClose={vi.fn()}
          canDelete={true}
          onRestore={onRestore}
        />,
      );
    });

    // Print button should be hidden for archived records
    expect(document.body.textContent).not.toContain("obligations.actions.printShort");

    // Click restore action
    const restoreBtn = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="common.restore"]',
    );
    expect(restoreBtn).not.toBeNull();

    await act(async () => {
      restoreBtn?.click();
    });

    expect(onRestore).toHaveBeenCalledWith(archivedCollection.id);
  });

  it("triggers print invoice modal when clicking print button", async () => {
    const root = createRoot(container!);

    await act(async () => {
      root.render(
        <ObligationCollectionDetail
          collection={mockCollection}
          obligationTypes={mockObligationTypes}
          reps={mockReps}
          mujtahids={mockMujtahids}
          distributions={mockDistributions}
          wakalaTypes={mockWakalaTypes}
          onClose={vi.fn()}
        />,
      );
    });

    const printBtn = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("obligations.actions.printShort"),
    );
    expect(printBtn).toBeDefined();

    await act(async () => {
      printBtn?.click();
    });

    expect(document.body.querySelector('[data-testid="print-invoice-modal"]')).not.toBeNull();
  });
});

import React, { act } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { ObligationCollectionsList } from "./ObligationCollectionsList";
import type {
  ObligationCollection,
  ObligationType,
  MujtahidRep,
  Mujtahid,
} from "@/lib/data/obligationsData";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useWorkDirectoryViewMode", () => ({
  useWorkDirectoryViewMode: () => ({
    viewMode: "table",
    setViewMode: vi.fn(),
  }),
}));

let passedContactIds: string[] = [];
vi.mock("@/tenant/features/obligations/hooks/useObligationLookups", () => ({
  useMergedObligationContacts: (ids: string[]) => {
    passedContactIds = ids;
    return [
      { id: "c-1", name: "Muhammad Ali", phone: "+923001112222" },
      { id: "ref-1", name: "Sayyid Kazim", phone: "+923219998888" },
    ];
  },
}));

vi.mock("@/tenant/features/obligations/components/ObligationCollectionsListFilters", () => ({
  ObligationCollectionsListFilters: ({
    search,
    onSearchChange,
  }: {
    search: string;
    onSearchChange: (v: string) => void;
  }) => (
    <div data-testid="filters">
      <input
        data-testid="search-input"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  ),
}));

vi.mock("@/tenant/features/obligations/components/ObligationsBulkActionBar", () => ({
  ObligationsBulkActionBar: () => <div data-testid="bulk-bar" />,
}));

vi.mock("@/tenant/features/obligations/components/ObligationCollectionsListContent", () => ({
  ObligationCollectionsListContent: ({ collections }: { collections: unknown[] }) => (
    <div data-testid="content">
      <span data-testid="rendered-count">{collections.length}</span>
    </div>
  ),
}));

const mockCollections: ObligationCollection[] = [
  {
    id: "col-1",
    receipt_no: "REC-001",
    received_date: "2025-01-01",
    sender_id: "c-1",
    amount: 100,
    currency_id: "USD",
    payment_mode: "Cash",
    obligation_type_id: "ot-1",
    mujtahid_representative_id: "rep-1",
    received_by: "u-1",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

const mockObligationTypes: ObligationType[] = [
  {
    id: "ot-1",
    name: "Khums",
    quantity_based: false,
    designated_for: "Both",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

const mockReps: MujtahidRep[] = [];
const mockMujtahids: Mujtahid[] = [];

describe("ObligationCollectionsList Component", () => {
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

  it("mounts and renders without exceeding maximum update depth", async () => {
    const onFilteredCountChange = vi.fn();
    const root = createRoot(container!);

    await act(async () => {
      root.render(
        <ObligationCollectionsList
          collections={mockCollections}
          obligationTypes={mockObligationTypes}
          reps={mockReps}
          mujtahids={mockMujtahids}
          onAddNew={vi.fn()}
          onView={vi.fn()}
          onFilteredCountChange={onFilteredCountChange}
          canWrite={true}
          canDelete={true}
          showDeleted={false}
          onToggleShowDeleted={vi.fn()}
          onDelete={vi.fn()}
          onRestore={vi.fn()}
          onBulkDelete={vi.fn()}
          onBulkRestore={vi.fn()}
        />,
      );
    });

    expect(container?.querySelector('[data-testid="filters"]')).not.toBeNull();
    expect(onFilteredCountChange).toHaveBeenCalledWith(1);

    // Re-render with showDeleted toggled to true (must not loop)
    await act(async () => {
      root.render(
        <ObligationCollectionsList
          collections={mockCollections}
          obligationTypes={mockObligationTypes}
          reps={mockReps}
          mujtahids={mockMujtahids}
          onAddNew={vi.fn()}
          onView={vi.fn()}
          onFilteredCountChange={onFilteredCountChange}
          canWrite={true}
          canDelete={true}
          showDeleted={true}
          onToggleShowDeleted={vi.fn()}
          onDelete={vi.fn()}
          onRestore={vi.fn()}
          onBulkDelete={vi.fn()}
          onBulkRestore={vi.fn()}
        />,
      );
    });

    expect(container?.querySelector('[data-testid="filters"]')).not.toBeNull();
  });

  it("deduplicates contact IDs across sender and reference contacts", async () => {
    const multiCollections: ObligationCollection[] = [
      {
        ...mockCollections[0]!,
        id: "col-1",
        sender_id: "c-1",
        reference_id: "ref-1",
      },
      {
        ...mockCollections[0]!,
        id: "col-2",
        sender_id: "c-1",
        reference_id: null,
      },
      {
        ...mockCollections[0]!,
        id: "col-3",
        sender_id: "c-2",
        reference_id: "ref-1",
      },
    ];

    const root = createRoot(container!);

    await act(async () => {
      root.render(
        <ObligationCollectionsList
          collections={multiCollections}
          obligationTypes={mockObligationTypes}
          reps={mockReps}
          mujtahids={mockMujtahids}
          onAddNew={vi.fn()}
          onView={vi.fn()}
        />,
      );
    });

    expect(passedContactIds).toEqual(["c-1", "ref-1", "c-2"]);
  });
});

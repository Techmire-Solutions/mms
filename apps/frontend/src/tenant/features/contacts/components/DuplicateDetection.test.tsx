import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DuplicateDetection } from "./DuplicateDetection";

vi.mock("@/tenant/features/contacts/hooks/useDuplicateDetectionState", () => ({
  useDuplicateDetectionState: () => ({
    prefs: {},
    pairsLoading: false,
    pairsFetching: false,
    pairsError: false,
    refetchPairs: vi.fn(),
    hasMore: false,
    activePairs: [],
    totalPairs: 0,
    tierCounts: { all: 0, high: 0, medium: 0, low: 0 },
    searchQuery: "",
    setSearchQuery: vi.fn(),
    tierFilter: "all",
    setTierFilter: vi.fn(),
    keepIndex: {},
    merging: null,
    confirming: false,
    totalMerged: 0,
    setMerging: vi.fn(),
    handleLoadMoreDuplicates: vi.fn(),
    handleMergeConfirm: vi.fn(),
    handleDismiss: vi.fn(),
    setKeepIndexForPair: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/contacts/components/DuplicateDetectionModal", () => ({
  DuplicateDetectionModal: () => <div data-testid="duplicate-modal">Duplicate Modal</div>,
}));

describe("DuplicateDetection Component", () => {
  it("renders duplicate detection modal container", () => {
    const html = renderToStaticMarkup(
      <DuplicateDetection onClose={vi.fn()} onMerge={vi.fn()} canWrite={true} />,
    );

    expect(html).toContain("Duplicate Modal");
  });
});

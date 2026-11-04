import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES, type Contact } from "@mms/shared";
import { DuplicateDetectionModal } from "./DuplicateDetectionModal";

vi.mock("@/components/app/Modal", () => ({
  Modal: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        <div>{children}</div>
      </div>
    ) : null,
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("DuplicateDetectionModal Component", () => {
  it("renders modal header, search input, and filter tabs", () => {
    const html = renderToStaticMarkup(
      <DuplicateDetectionModal
        prefs={DEFAULT_CONTACT_PREFERENCES}
        pairsLoading={false}
        pairsFetching={false}
        pairsError={false}
        hasMore={false}
        activePairs={[]}
        totalPairs={0}
        tierCounts={{ all: 0, high: 0, medium: 0, low: 0 }}
        searchQuery=""
        setSearchQuery={vi.fn()}
        tierFilter="all"
        setTierFilter={vi.fn()}
        keepIndex={{}}
        totalMerged={0}
        canWrite={true}
        onClose={vi.fn()}
        onMergePair={vi.fn()}
        onDismiss={vi.fn()}
        onSelectKeep={vi.fn()}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(html).toContain("contacts.duplicates.title");
    expect(html).toContain("contacts.duplicates.filterAll");
    expect(html).toContain("contacts.duplicates.allResolved");
  });

  it("renders batch merge action when highConfidenceCount > 0 and canWrite is true", () => {
    const html = renderToStaticMarkup(
      <DuplicateDetectionModal
        prefs={DEFAULT_CONTACT_PREFERENCES}
        pairsLoading={false}
        pairsFetching={false}
        pairsError={false}
        hasMore={false}
        activePairs={[]}
        totalPairs={2}
        tierCounts={{ all: 2, high: 2, medium: 0, low: 0 }}
        searchQuery=""
        setSearchQuery={vi.fn()}
        tierFilter="all"
        setTierFilter={vi.fn()}
        keepIndex={{}}
        totalMerged={0}
        canWrite={true}
        highConfidenceCount={2}
        batchMerging={false}
        batchConfirmOpen={false}
        setBatchConfirmOpen={vi.fn()}
        onBatchMergeConfirm={vi.fn()}
        onClose={vi.fn()}
        onMergePair={vi.fn()}
        onDismiss={vi.fn()}
        onSelectKeep={vi.fn()}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(html).toContain("contacts.duplicates.batchMergeHigh");
  });
});

function duplicatePair(index: number) {
  const contact = (id: string): Contact =>
    ({ id, name: `Contact ${id}`, phones: [], emails: [] }) as unknown as Contact;
  return {
    id: `pair-${index}`,
    confidence: 98,
    reason: "same phone",
    contacts: [contact(`a-${index}`), contact(`b-${index}`)] as [Contact, Contact],
  };
}

function renderPairs(count: number): string {
  return renderToStaticMarkup(
    <DuplicateDetectionModal
      prefs={DEFAULT_CONTACT_PREFERENCES}
      pairsLoading={false}
      pairsFetching={false}
      pairsError={false}
      hasMore={false}
      activePairs={Array.from({ length: count }, (_, index) => duplicatePair(index))}
      totalPairs={count}
      tierCounts={{ all: count, high: count, medium: 0, low: 0 }}
      searchQuery=""
      setSearchQuery={vi.fn()}
      tierFilter="all"
      setTierFilter={vi.fn()}
      keepIndex={{}}
      totalMerged={0}
      canWrite={true}
      onClose={vi.fn()}
      onMergePair={vi.fn()}
      onDismiss={vi.fn()}
      onSelectKeep={vi.fn()}
      onLoadMore={vi.fn()}
      onRetry={vi.fn()}
    />,
  );
}

function renderedPairCount(html: string): number {
  return (html.match(/data-pair-id=/g) ?? []).length;
}

describe("DuplicateDetectionModal pair-list virtualization", () => {
  it("renders every pair below the threshold", () => {
    const html = renderPairs(10);

    expect(renderedPairCount(html)).toBe(10);
    expect(html).not.toContain('data-testid="duplicate-pairs-virtual-window"');
  });

  it("swaps to the virtual window above the threshold instead of mounting 60 cards", () => {
    const html = renderPairs(60);

    expect(html).toContain('data-testid="duplicate-pairs-virtual-window"');
    expect(renderedPairCount(html)).toBeLessThan(60);
  });
});

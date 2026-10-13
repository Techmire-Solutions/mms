import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONTACT_PREFERENCES } from "@mms/shared";
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
});

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DuplicateDetectionToolbar } from "./DuplicateDetectionToolbar";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count != null) {
        return `${key}:${params.count}`;
      }
      return key;
    },
  }),
}));

const filterTabs = [
  { id: "all" as const, label: "All", count: 5 },
  { id: "high" as const, label: "High", count: 2 },
  { id: "medium" as const, label: "Medium", count: 2 },
  { id: "low" as const, label: "Low", count: 1 },
];

describe("DuplicateDetectionToolbar Component", () => {
  it("renders search input and filter tabs with counts", () => {
    const html = renderToStaticMarkup(
      <DuplicateDetectionToolbar
        searchQuery="test"
        onSearchChange={vi.fn()}
        tierFilter="all"
        onTierFilterChange={vi.fn()}
        filterTabs={filterTabs}
        searchPlaceholder="Search duplicates..."
      />,
    );

    expect(html).toContain('value="test"');
    expect(html).toContain("Search duplicates...");
    expect(html).toContain("All");
    expect(html).toContain("5");
    expect(html).not.toContain("contacts.duplicates.batchMergeHigh");
  });

  it("renders batch merge button when highConfidenceCount > 0 and canWrite is true", () => {
    const html = renderToStaticMarkup(
      <DuplicateDetectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        tierFilter="all"
        onTierFilterChange={vi.fn()}
        filterTabs={filterTabs}
        searchPlaceholder="Search duplicates..."
        canWrite={true}
        highConfidenceCount={3}
        onBatchMergeClick={vi.fn()}
      />,
    );

    expect(html).toContain("contacts.duplicates.batchMergeHigh:3");
  });

  it("renders merging label when batchMerging is active", () => {
    const html = renderToStaticMarkup(
      <DuplicateDetectionToolbar
        searchQuery=""
        onSearchChange={vi.fn()}
        tierFilter="all"
        onTierFilterChange={vi.fn()}
        filterTabs={filterTabs}
        searchPlaceholder="Search duplicates..."
        canWrite={true}
        highConfidenceCount={3}
        batchMerging={true}
        onBatchMergeClick={vi.fn()}
      />,
    );

    expect(html).toContain("contacts.duplicates.batchMerging:3");
    expect(html).toContain("disabled");
  });
});

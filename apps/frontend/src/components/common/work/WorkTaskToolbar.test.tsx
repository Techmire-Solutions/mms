import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkTaskToolbar } from "./WorkTaskToolbar";
import { TranslationContext, type TranslationFunction } from "@/lib/contexts/TranslationContext";

const mockContext = {
  language: "en",
  t: ((key: string) => key) as TranslationFunction,
  isLoading: false,
  dir: "ltr" as const,
  isRtl: false,
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <TranslationContext.Provider value={mockContext}>{children}</TranslationContext.Provider>;
}

describe("WorkTaskToolbar", () => {
  it("renders search bar, region label, and placeholders", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkTaskToolbar
          regionLabel="Student filters"
          search="Ali"
          onSearchChange={vi.fn()}
          searchPlaceholder="Search students..."
          shownCountLabel="Showing 15 students"
        />
      </TestWrapper>,
    );

    expect(html).toContain('aria-label="Student filters"');
    expect(html).toContain('placeholder="Search students..."');
    expect(html).toContain("Showing 15 students");
  });

  it("renders status filter pills", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkTaskToolbar
          regionLabel="Tasks toolbar"
          search=""
          onSearchChange={vi.fn()}
          searchPlaceholder="Search..."
          statusFilter={{
            activeIds: ["active"],
            allLabel: "All Tasks",
            onResetAll: vi.fn(),
            options: [
              { id: "active", label: "Active", count: 12 },
              { id: "inactive", label: "Inactive", count: 4 },
            ],
            onToggle: vi.fn(),
          }}
        />
      </TestWrapper>,
    );

    expect(html).toContain("All Tasks");
    expect(html).toContain("Active");
    expect(html).toContain("12");
    expect(html).toContain("Inactive");
    expect(html).toContain("4");
  });

  it("renders date range inputs", () => {
    const html = renderToStaticMarkup(
      <TestWrapper>
        <WorkTaskToolbar
          regionLabel="Records toolbar"
          search=""
          onSearchChange={vi.fn()}
          searchPlaceholder="Search..."
          dateRange={{
            startDate: "2026-09-01",
            endDate: "2026-09-30",
            onDateRangeChange: vi.fn(),
            startPlaceholder: "From",
            endPlaceholder: "To",
          }}
        />
      </TestWrapper>,
    );

    expect(html).toContain('value="2026-09-01"');
    expect(html).toContain('value="2026-09-30"');
    expect(html).toContain('placeholder="From"');
    expect(html).toContain('placeholder="To"');
  });
});

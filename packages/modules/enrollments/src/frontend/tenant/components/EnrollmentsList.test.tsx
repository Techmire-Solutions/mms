import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsList } from "./EnrollmentsList";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@mms/fe-core/tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/fe-core/tenant")>();
  return {
    ...actual,

    useWorkDirectoryViewMode: () => ({
      viewMode: "table",
      setViewMode: vi.fn(),
    }),
  };
});

vi.mock("../host/useCurrency", () => ({
  useFinanceCurrency: () => ({
    formatCurrency: (val: number) => `$${val}`,
  }),
}));

vi.mock("../host/useMessageComposerState.js", () => ({
  useMessageComposerState: () => ({
    messagingTarget: null,
    openComposer: vi.fn(),
    closeComposer: vi.fn(),
  }),
}));

vi.mock("../host/sessionsCollection", () => ({
  useSessionsCollection: () => [],
}));

vi.mock("../host/studentsCollection", () => ({
  useStudentsByIds: () => ({ data: [] }),
}));

vi.mock("./EnrollmentsListFilters", () => ({
  EnrollmentsListFilters: () => <div data-testid="list-filters">List Filters</div>,
}));

vi.mock("./EnrollmentsListContent", () => ({
  EnrollmentsListContent: () => <div data-testid="list-content">List Content</div>,
}));

describe("EnrollmentsList Component", () => {
  it("renders filters and content containers", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsList
        enrollments={[]}
        total={0}
        page={1}
        pageSize={25}
        search=""
        statusFilter="all"
        sessionFilter="all"
        canWrite={true}
        canSelectEnrollments={true}
        selectedIds={[]}
        allVisibleSelected={false}
        someVisibleSelected={false}
        onSearchChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onSessionFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
        onPageChange={vi.fn()}
        onView={vi.fn()}
        onCancel={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onToggleSelectedEnrollment={vi.fn()}
        columnCustomizer={{} as unknown as never}
      />,
    );

    expect(html).toContain("List Filters");
    expect(html).toContain("List Content");
  });
});

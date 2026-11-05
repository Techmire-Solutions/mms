import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_STUDENT_COLUMN_REGISTRY, type Student } from "@mms/shared";
import type { useStudentColumnLayout } from "@/tenant/features/students/hooks/useStudentColumnLayout";
import { StudentsList } from "./StudentsList";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessionsCollection: () => [],
}));

const mockStudent: Student = {
  id: "std-list-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  gender: "male",
  grNumber: "GR-55",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockColumnLayout = {
  columnRegistry: DEFAULT_STUDENT_COLUMN_REGISTRY,
  isColumnVisible: () => true,
  getColumnWidth: () => undefined,
  setColumnWidth: vi.fn(),
  resetColumns: vi.fn(),
  toggleColumn: vi.fn(),
  reorderColumns: vi.fn(),
  updateUserColumnLayout: vi.fn(),
  customizerLabels: {} as never,
  resetColumnLayout: vi.fn(),
} as unknown as ReturnType<typeof useStudentColumnLayout>;

const baseProps = {
  isWorkPageLoading: false,
  isWorkPageError: false,
  isWorkPageFetching: false,
  onRetry: vi.fn(),
  workStudents: [mockStudent],
  workPageData: undefined,
  useServerWork: false,
  viewMode: "table" as const,
  columnLayout: mockColumnLayout,
  onPageChange: vi.fn(),
  hasActiveFilters: false,
  onClearFilters: vi.fn(),
  onShowActive: vi.fn(),
  selectedIds: [],
  onSelectOne: vi.fn(),
  onSelectAll: vi.fn(),
  allSelected: false,
  someSelected: false,
  sessions: [],
  statusBadgeConfig: {},
  sortField: null,
  sortDir: "asc" as const,
  onSortChange: vi.fn(),
  onServerSort: vi.fn(),
  openComposer: vi.fn(),
  canWriteMessaging: true,
  onDeleteTargetChange: vi.fn(),
  onViewStudent: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onRestore: vi.fn(),
};

describe("StudentsList Component", () => {
  it("renders table view with student data", () => {
    const html = renderToStaticMarkup(<StudentsList {...baseProps} />);

    expect(html).toContain("Zayd Harith");
  });

  it("renders cards view when viewMode is cards", () => {
    const html = renderToStaticMarkup(<StudentsList {...baseProps} viewMode="cards" />);

    expect(html).toContain("Zayd Harith");
  });

  it("renders empty state when workStudents is empty", () => {
    const html = renderToStaticMarkup(<StudentsList {...baseProps} workStudents={[]} />);

    expect(html).toContain("students.noStudentsYet");
  });

  it("keeps pagination on an empty page so the user can navigate back", () => {
    // 2026-11-04 review (X-02/S-m8): pagination was gated on the row count, so deleting
    // the last rows of page 2 hid the only control that could return to page 1.
    const html = renderToStaticMarkup(
      <StudentsList
        {...baseProps}
        workStudents={[]}
        useServerWork={true}
        workPageData={{ students: [], total: 10, page: 2, limit: 10, hasMore: false }}
      />,
    );

    expect(html).toContain("Pagination");
  });
});

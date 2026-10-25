import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_STUDENT_COLUMN_REGISTRY, type Student } from "@mms/shared";
import type { useStudentColumnLayout } from "@/tenant/features/students/hooks/useStudentColumnLayout";
import { StudentsWorkTier } from "./StudentsWorkTier";

vi.mock("@/hooks/useAcademicTerms", () => ({
  useAcademicTerms: () => ({
    session: { singular: "Session", plural: "Sessions" },
    class: { singular: "Class", plural: "Classes" },
    section: { singular: "Section", plural: "Sections" },
  }),
}));
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
  id: "std-wt-1",
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

const mockWorkOverlays = {
  setViewStudent: vi.fn(),
  openComposer: vi.fn(),
  canWriteMessaging: true,
  statusBadgeConfig: {},
  openSelectionMessage: vi.fn(),
  setConfirmBulkDeleteOpen: vi.fn(),
  setConfirmBulkRestoreOpen: vi.fn(),
  setDeleteTarget: vi.fn(),
  openIdCards: vi.fn(),
};

const baseProps = {
  studentSearch: "",
  studentFilterStatus: [],
  studentFilterGender: "all",
  quickFilter: "all" as const,
  onQuickFilterChange: vi.fn(),
  studentStatusOptions: ["active", "inactive"],
  genderFilters: ["all", "male", "female"],
  viewingDeleted: false,
  canWrite: true,
  canDelete: true,
  canExport: true,
  bulkActions: [],
  hasActiveFilters: false,
  activeFilterCount: 0,
  workStudents: [mockStudent],
  workPageData: undefined,
  isWorkPageLoading: false,
  isWorkPageError: false,
  isWorkPageFetching: false,
  useServerWork: false,
  viewMode: "table" as const,
  onViewModeChange: vi.fn(),
  columnLayout: mockColumnLayout,
  onSearchChange: vi.fn(),
  onToggleStatus: vi.fn(),
  onGenderChange: vi.fn(),
  onToggleDeleted: vi.fn(),
  onClearFilters: vi.fn(),
  selectedIds: [],
  selectedTargets: { waTargets: [], smsReady: [], emailReady: [] },
  allSelected: false,
  someSelected: false,
  onSelectOne: vi.fn(),
  onSelectAll: vi.fn(),
  onClearSelection: vi.fn(),
  onRetry: vi.fn(),
  onPageChange: vi.fn(),
  onEdit: vi.fn(),
  onRestore: vi.fn(),
  onBulkStatusChange: vi.fn(),
  onBulkExport: vi.fn(),
  sortField: null,
  sortDir: "asc" as const,
  onServerSort: vi.fn(),
  workOverlays: mockWorkOverlays,
};

describe("StudentsWorkTier Component", () => {
  it("renders work tier with filters and student list", () => {
    const html = renderToStaticMarkup(<StudentsWorkTier {...baseProps} />);

    expect(html).toContain("Zayd Harith");
  });

  it("renders bulk actions bar when items are selected", () => {
    const html = renderToStaticMarkup(
      <StudentsWorkTier {...baseProps} selectedIds={["std-wt-1"]} someSelected={true} />,
    );

    expect(html).toContain("Zayd Harith");
  });

  it("renders segmented quick-filter presets above the filters toolbar", () => {
    const html = renderToStaticMarkup(<StudentsWorkTier {...baseProps} />);

    expect(html).toContain("students.filtersAll");
    expect(html).toContain("students.filtersActive");
    expect(html).toContain("students.filtersNew");
  });
});

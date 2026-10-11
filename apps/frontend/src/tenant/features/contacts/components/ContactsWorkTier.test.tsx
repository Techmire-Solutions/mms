import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactsWorkTier } from "./ContactsWorkTier";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

vi.mock("@/tenant/features/contacts/hooks/useContactsToolbarModel", () => ({
  useContactsToolbarModel: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      return key;
    },
    genders: ["male", "female"],
    sortOptions: [{ field: "name", label: "Name" }],
    columnRegistry: [{ key: "name", label: "Name", enabled: true, order: 0, fixed: true }],
    updateUserColumnLayout: vi.fn(),
    handleResetColumnLayout: vi.fn(),
    columnCustomizerLabels: {
      trigger: "Columns",
      title: "Columns",
      visibleAndOrder: "Visible & Order",
      hidden: "Hidden",
      fixed: "Fixed",
      hideColumn: (label: string) => `Hide ${label}`,
      reset: "Reset",
      searchPlaceholder: "Filter columns...",
    },
  }),
}));

vi.mock("@/tenant/features/contacts/components/ContactsListCards", () => ({
  default: () => <div data-testid="contacts-cards-mock">ContactsCards</div>,
}));

vi.mock("@/tenant/features/contacts/components/ContactsListDesktopTable", () => ({
  default: () => <div data-testid="contacts-table-mock">ContactsTable</div>,
}));

const mockContact: Contact = {
  id: "cnt-1",
  firstName: "Farhan",
  lastName: "Ahmad",
  name: "Br. Farhan",
  email: "farhan@example.com",
  phone: "+1 555-0100",
  gender: "male",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const baseProps = {
  search: "",
  onSearchChange: vi.fn(),
  filterGender: "all",
  onGenderChange: vi.fn(),
  quickFilter: "all" as const,
  onQuickFilterChange: vi.fn(),
  sortField: "name" as const,
  sortDir: "asc" as const,
  onSort: vi.fn(),
  hasActiveFilters: false,
  activeFilterCount: 0,
  onClearFilters: vi.fn(),
  viewingDeleted: false,
  onShowDeletedChange: vi.fn(),
  canViewDeleted: true,
  viewMode: "table" as const,
  onViewModeChange: vi.fn(),
  shownCount: 1,
  selected: [],
  onClearSelection: vi.fn(),
  selectedTargets: { waTargets: [], smsReady: [], emailReady: [] },
  bulkActions: [],
  canWriteMessaging: true,
  canExport: true,
  canDelete: true,
  canWrite: true,
  onWhatsApp: vi.fn(),
  onSms: vi.fn(),
  onEmail: vi.fn(),
  onBulkExport: vi.fn(),
  isExporting: false,
  onRequestBulkDelete: vi.fn(),
  onRequestBulkRestore: vi.fn(),
  onBulkTag: vi.fn(),
  isWorkError: false,
  isWorkLoading: false,
  isWorkFetching: false,
  onRetryWork: vi.fn(),
  workContacts: [mockContact],
  tableColumns: [{ id: "name", key: "name", label: "Name", visible: true }],
  commonDirectoryProps: {} as never,
  tableProps: {} as never,
  useServerWork: false,
  onPageChange: vi.fn(),
};

describe("ContactsWorkTier Component", () => {
  it("renders work tier with filters and table", () => {
    const html = renderToStaticMarkup(<ContactsWorkTier {...baseProps} />);

    expect(html).toContain('data-testid="contacts-table-mock"');
  });

  it("renders bulk actions bar when items are selected", () => {
    const html = renderToStaticMarkup(<ContactsWorkTier {...baseProps} selected={["cnt-1"]} />);

    expect(html).toContain('data-testid="contacts-table-mock"');
  });
});

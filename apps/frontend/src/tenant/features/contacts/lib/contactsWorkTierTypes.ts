import type { ComponentProps } from "react";
import type { Contact, ContactsQuickFilter } from "@mms/shared";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type ContactsListCards from "@/tenant/features/contacts/components/ContactsListCards";
import type ContactsListDesktopTable from "@/tenant/features/contacts/components/ContactsListDesktopTable";
import type { ContactsColumnConfig } from "@/tenant/features/contacts/components/contactTableTypes";

type ContactsWorkTierColumn = ContactsColumnConfig;

export type ContactsWorkViewMode = WorkDirectoryViewMode;

export interface ContactsWorkTierProps {
  search: string;
  onSearchChange: (value: string) => void;
  filterGender: string;
  onGenderChange: (value: string) => void;
  quickFilter: ContactsQuickFilter;
  onQuickFilterChange: (value: ContactsQuickFilter) => void;
  sortField: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearFilters: () => void;
  viewingDeleted: boolean;
  onShowDeletedChange: (next: boolean) => void;
  canViewDeleted: boolean;
  viewMode: ContactsWorkViewMode;
  onViewModeChange: (mode: ContactsWorkViewMode) => void;
  shownCount: number;
  selected: Array<string | number>;
  onClearSelection: () => void;
  selectedTargets: {
    waTargets: Contact[];
    smsReady: Contact[];
    emailReady: Contact[];
  };
  bulkActions: readonly string[];
  canWriteMessaging: boolean;
  canExport: boolean;
  canDelete: boolean;
  canWrite: boolean;
  onWhatsApp: (targets: Contact[]) => void;
  onSms: (targets: Contact[]) => void;
  onEmail: (targets: Contact[]) => void;
  onBulkExport: () => void | Promise<void>;
  /** Server export in flight — disables the bulk export CTA and shows a spinner. */
  isExporting: boolean;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onBulkTag?: (tags: string[]) => Promise<void> | void;
  isWorkError: boolean;
  isWorkLoading: boolean;
  isWorkFetching: boolean;
  onRetryWork: () => void;
  workContacts: Contact[];
  tableColumns: ContactsWorkTierColumn[];
  commonDirectoryProps: ComponentProps<typeof ContactsListCards>;
  tableProps: ComponentProps<typeof ContactsListDesktopTable>;
  useServerWork: boolean;
  workPageData?: { page: number; total: number; limit: number; hasMore: boolean } | null;
  onPageChange: (page: number) => void;
}

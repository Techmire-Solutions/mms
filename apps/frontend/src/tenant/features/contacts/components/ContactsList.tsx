import React from "react";
import { UserX } from "lucide-react";
import type { Contact } from "@mms/shared";
import { ModuleWorkDirectoryEmpty } from "@/components/app/ModuleWorkDirectoryEmpty";
import { ModuleWorkListStateShell } from "@/components/app/ModuleWorkListStateShell";
import ContactsListDesktopTable from "@/tenant/features/contacts/components/ContactsListDesktopTable";
import ContactsListCards from "@/tenant/features/contacts/components/ContactsListCards";
import type { ContactsColumnConfig } from "@/tenant/features/contacts/lib/contactTableTypes";
import type { ContactsWorkViewMode } from "@/tenant/features/contacts/lib/contactsWorkTierTypes";
import { useTranslation } from "@/hooks/useTranslation";

export interface ContactsListProps {
  isWorkError: boolean;
  isWorkLoading: boolean;
  isWorkFetching: boolean;
  onRetryWork: () => void;
  workContacts: Contact[];
  tableColumns: ContactsColumnConfig[];
  hasActiveFilters: boolean;
  viewingDeleted: boolean;
  canWrite: boolean;
  onClearFilters: () => void;
  onShowDeletedChange?: (show: boolean) => void;
  viewMode: ContactsWorkViewMode;
  commonDirectoryProps: React.ComponentProps<typeof ContactsListCards>;
  tableProps: React.ComponentProps<typeof ContactsListDesktopTable>;
  useServerWork: boolean;
  workPageData?: { page: number; total: number; limit: number; hasMore: boolean } | null;
  onPageChange: (page: number) => void;
}

export const ContactsList = React.memo(function ContactsList({
  isWorkError,
  isWorkLoading,
  isWorkFetching,
  onRetryWork,
  workContacts,
  tableColumns,
  hasActiveFilters,
  viewingDeleted,
  canWrite,
  onClearFilters,
  onShowDeletedChange,
  viewMode,
  commonDirectoryProps,
  tableProps,
  useServerWork,
  workPageData,
  onPageChange,
}: ContactsListProps): React.JSX.Element {
  const { t } = useTranslation();

  const emptyDescription = hasActiveFilters
    ? t("contacts.tryAdjustingFilters")
    : viewingDeleted
      ? t("contacts.emptyTrashHint")
      : canWrite
        ? t("contacts.clickAddContact")
        : t("contacts.emptyDirectoryReadOnly");

  return (
    <ModuleWorkListStateShell
      isError={isWorkError}
      isLoading={isWorkLoading}
      isFetching={isWorkFetching}
      onRetry={onRetryWork}
      errorTitle={t("contacts.loadFailed")}
      errorHint={t("contacts.loadFailedHint")}
      viewMode={viewMode}
      skeletonColumnCount={tableColumns.length}
      useServerWork={useServerWork}
      pageData={workPageData}
      onPageChange={onPageChange}
      i18nNamespace="contacts"
      showPagination={workContacts.length > 0}
      loadingLabel={t("common.loading")}
    >
      {workContacts.length === 0 ? (
        <ModuleWorkDirectoryEmpty
          icon={UserX}
          title={
            hasActiveFilters
              ? t("contacts.noContactsMatchFilters")
              : viewingDeleted
                ? t("contacts.noDeletedContacts")
                : t("contacts.noContactsYet")
          }
          description={emptyDescription}
          hasActiveFilters={hasActiveFilters}
          viewingDeleted={viewingDeleted}
          onClearFilters={onClearFilters}
          onShowActive={onShowDeletedChange ? () => onShowDeletedChange(false) : undefined}
          clearFiltersLabel={t("contacts.clearFilters")}
          showActiveLabel={t("contacts.showActive")}
        />
      ) : viewMode === "cards" ? (
        <ContactsListCards {...commonDirectoryProps} />
      ) : (
        <div className="space-y-2">
          <ContactsListDesktopTable {...tableProps} />
        </div>
      )}
    </ModuleWorkListStateShell>
  );
});

import React, { type JSX, type ReactNode } from "react";
import { UserX } from "lucide-react";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { Contact } from "@mms/shared";
import { ModuleWorkDirectoryEmpty } from "@/components/ui/ModuleWorkDirectoryEmpty";
import {
  ModuleWorkListStateShell,
  type ModuleWorkListPageData,
} from "@/components/ui/ModuleWorkListStateShell";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import type { MessagingSelectedMap } from "@/tenant/features/messaging/components/messagingWorkPanelShared";
import { MessagingWorkRecipientsCards } from "./MessagingWorkRecipientsCards";
import { MessagingWorkRecipientsTable } from "./MessagingWorkRecipientsTable";

export interface MessagingWorkRecipientsListProps {
  viewMode: WorkDirectoryViewMode;
  contacts: Contact[];
  selectedById: MessagingSelectedMap;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  selectedCount: number;
  selectedCountLabel: ReactNode;
  pageCountLabel: ReactNode;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  pageData?: ModuleWorkListPageData | null;
  onPageChange: (page: number) => void;
  getColumnWidth: (key: string) => number | undefined;
  isColumnVisible?: (key: string) => boolean;
  onToggleRecipient: (contact: Contact) => void;
  onToggleAllVisible: (checked: boolean) => void;
  setColumnWidth: (key: string, width: number) => void;
}

export function MessagingWorkRecipientsList({
  viewMode,
  contacts,
  selectedById,
  allVisibleSelected,
  someVisibleSelected,
  selectedCount,
  selectedCountLabel,
  pageCountLabel,
  isPending,
  isFetching,
  isError,
  onRetry,
  hasActiveFilters,
  onClearFilters,
  pageData,
  onPageChange,
  getColumnWidth,
  isColumnVisible = () => true,
  onToggleRecipient,
  onToggleAllVisible,
  setColumnWidth,
}: MessagingWorkRecipientsListProps): JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  const showRecipientCol = isColumnVisible("recipient");
  const showPhoneCol = isColumnVisible("phone");
  const showEmailCol = isColumnVisible("email");

  return (
    <ModuleWorkListStateShell
      isError={isError}
      isLoading={isPending && contacts.length === 0}
      isFetching={isFetching}
      onRetry={onRetry}
      errorTitle={t("messaging.loadFailed")}
      errorHint={t("messaging.loadFailedHint")}
      viewMode={viewMode}
      skeletonColumnCount={4}
      useServerWork={true}
      pageData={pageData}
      onPageChange={onPageChange}
      i18nNamespace="messaging"
      showPagination={contacts.length > 0}
      loadingLabel={t("common.loading")}
    >
      {contacts.length === 0 ? (
        <ModuleWorkDirectoryEmpty
          icon={UserX}
          title={
            hasActiveFilters
              ? t("contacts.noContactsMatchFilters")
              : t("messaging.noMatchingRecipients")
          }
          description={
            hasActiveFilters
              ? t("contacts.tryAdjustingFilters")
              : t("messaging.selectRecipientsDesc")
          }
          hasActiveFilters={hasActiveFilters}
          viewingDeleted={false}
          onClearFilters={onClearFilters}
          clearFiltersLabel={t("common.clearFilters")}
          showActiveLabel=""
        />
      ) : viewMode === "cards" ? (
        <MessagingWorkRecipientsCards
          contacts={contacts}
          selectedById={selectedById}
          allVisibleSelected={allVisibleSelected}
          someVisibleSelected={someVisibleSelected}
          selectedCountLabel={selectedCountLabel}
          pageCountLabel={pageCountLabel}
          reducedMotion={reducedMotion}
          showPhoneCol={showPhoneCol}
          showEmailCol={showEmailCol}
          onToggleRecipient={onToggleRecipient}
          onToggleAllVisible={onToggleAllVisible}
        />
      ) : (
        <MessagingWorkRecipientsTable
          contacts={contacts}
          selectedById={selectedById}
          allVisibleSelected={allVisibleSelected}
          someVisibleSelected={someVisibleSelected}
          selectedCount={selectedCount}
          selectedCountLabel={selectedCountLabel}
          pageCountLabel={pageCountLabel}
          showRecipientCol={showRecipientCol}
          showPhoneCol={showPhoneCol}
          showEmailCol={showEmailCol}
          getColumnWidth={getColumnWidth}
          setColumnWidth={setColumnWidth}
          onToggleRecipient={onToggleRecipient}
          onToggleAllVisible={onToggleAllVisible}
        />
      )}
    </ModuleWorkListStateShell>
  );
}

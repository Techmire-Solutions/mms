import { SessionCard } from "./SessionCard";
import type { SessionsWorkViewProps } from "../lib/sessionsWorkListViewsShared";
import { ModuleDirectoryCards } from "@mms/fe-core/components/ModuleDirectoryCards";
import { useReducedMotion } from "@mms/fe-core/tenant";
import { useTranslation } from "@mms/fe-core/i18n";
import { formatDirectoryPageCountLabel } from "@mms/fe-core/tenant/formatDirectoryPageCountLabel";

interface SessionsListCardsProps extends SessionsWorkViewProps {
  canSelectSessions: boolean;
  selectedIds: string[];
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectedSession: (id: string, checked: boolean) => void;
}

export function SessionsListCards({
  sessions,
  showDeleted,
  canDelete,
  canSelectSessions,
  selectedIds,
  allVisibleSelected,
  someVisibleSelected,
  isColumnVisible,
  columnRegistry,
  statusConfig,
  typeConfig,
  onOpenDetail,
  onRequestDelete,
  onRestore,
  onToggleSelectAll,
  onToggleSelectedSession,
}: SessionsListCardsProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const pageCountLabel = formatDirectoryPageCountLabel(sessions.length, t, {
    singular: "sessions.form.session",
    plural: "sessions.table.sessions",
  });

  return (
    <ModuleDirectoryCards
      items={sessions}
      selectedIds={selectedIds}
      onSelectAll={canSelectSessions ? () => onToggleSelectAll(!allVisibleSelected) : undefined}
      allSelected={allVisibleSelected}
      someSelected={someVisibleSelected}
      selectAllLabel={t("sessions.table.selectAll")}
      deselectAllLabel={t("common.deselect")}
      selectedCountLabel={t("sessions.selectedCount", { count: selectedIds.length })}
      pageCountLabel={pageCountLabel}
      checkboxIdPrefix="sessions-select-cards"
      renderItem={(sessionItem: any) => (
        <SessionCard
          key={sessionItem.id}
          session={sessionItem}
          selectedIds={selectedIds}
          canSelectSessions={canSelectSessions}
          showDeleted={showDeleted}
          canDelete={canDelete}
          isColumnVisible={isColumnVisible}
          columnRegistry={columnRegistry}
          statusConfig={statusConfig}
          typeConfig={typeConfig}
          onView={onOpenDetail}
          onToggleSelectedSession={onToggleSelectedSession}
          onRequestDelete={onRequestDelete}
          onRestore={onRestore}
          reducedMotion={reducedMotion}
        />
      )}
    />
  );
}

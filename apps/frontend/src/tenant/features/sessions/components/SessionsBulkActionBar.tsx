import type { ReactElement } from "react";
import { Calendar } from "lucide-react";
import { SESSIONS_MODULE_MANIFEST } from "@mms/shared";
import { BulkSelectionBar } from "@/components/app/BulkSelectionBar";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";

export interface SessionsBulkActionBarProps {
  selectedCount: number;
  showDeleted: boolean;
  canWrite?: boolean;
  canDelete: boolean;
  canExport?: boolean;
  statusConfig?: Record<string, StatusBadgeConfigItem>;
  onBulkStatusChange?: (status: string) => void;
  statusPending?: boolean;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onClearSelection: () => void;
  onBulkExport?: () => void;
  bulkActions?: readonly string[];
}

/** Sessions Work bulk bar — delegates to shared BulkSelectionBar. */
export function SessionsBulkActionBar({
  selectedCount,
  showDeleted,
  canWrite = false,
  canDelete,
  canExport = false,
  statusConfig,
  onBulkStatusChange,
  statusPending = false,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onClearSelection,
  onBulkExport,
  bulkActions = SESSIONS_MODULE_MANIFEST.work.bulkActions,
}: SessionsBulkActionBarProps): ReactElement {
  const { t } = useTranslation();

  return (
    <BulkSelectionBar
      selectedCount={selectedCount}
      viewingDeleted={showDeleted}
      canWrite={canWrite}
      canDelete={canDelete}
      canExport={canExport}
      leadingIcon={Calendar}
      i18nNamespace="sessions"
      bulkActions={bulkActions}
      onClearSelection={onClearSelection}
      onRequestBulkDelete={onRequestBulkDelete}
      onRequestBulkRestore={onRequestBulkRestore}
      onBulkExport={onBulkExport}
      statusConfig={statusConfig}
      onBulkStatusChange={onBulkStatusChange}
      statusPending={statusPending}
      deleteLabel={t("sessions.archive")}
    />
  );
}

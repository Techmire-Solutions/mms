import React from "react";
import type { PlatformUserProfile } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { StatusBulkActionDock } from "@/components/ui/StatusBulkActionDock";

export interface PlatformAdminBulkDockProps {
  selectedCount: number;
  selectedAdmins: PlatformUserProfile[];
  onClearSelection: () => void;
  onBulkExport: () => void;
  onBulkEnable?: (admins: PlatformUserProfile[]) => void;
  onBulkDisable?: (admins: PlatformUserProfile[]) => void;
  busy?: boolean;
}

export function PlatformAdminBulkDock({
  selectedCount,
  selectedAdmins,
  onClearSelection,
  onBulkExport,
  onBulkEnable,
  onBulkDisable,
  busy = false,
}: PlatformAdminBulkDockProps): React.JSX.Element | null {
  const { t } = useTranslation();

  return (
    <StatusBulkActionDock
      selectedCount={selectedCount}
      countLabel={t("platform.workspaces.selectedCount", { count: selectedCount })}
      onClearSelection={onClearSelection}
      clearLabel={t("common.deselect")}
      exportLabel={t("platform.workspaces.exportSelected")}
      enableLabel={t("platform.enableAdminConfirm")}
      disableLabel={t("platform.disableAdminConfirm")}
      onExport={onBulkExport}
      onEnable={onBulkEnable ? () => onBulkEnable(selectedAdmins) : undefined}
      onDisable={onBulkDisable ? () => onBulkDisable(selectedAdmins) : undefined}
      busy={busy}
    />
  );
}

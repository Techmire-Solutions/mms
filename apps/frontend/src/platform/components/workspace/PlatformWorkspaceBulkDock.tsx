import React from "react";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { StatusBulkActionDock } from "@/components/app/StatusBulkActionDock";
import { downloadWorkspacesCsv } from "@/platform/components/platformWorkspaceListData";

export interface PlatformWorkspaceBulkDockProps {
  selectedCount: number;
  selectedWorkspaces: PlatformWorkspaceRowData[];
  onClearSelection: () => void;
  onBulkEnable: (workspaces: PlatformWorkspaceRowData[]) => void;
  onBulkDisable: (workspaces: PlatformWorkspaceRowData[]) => void;
  busy?: boolean;
}

export function PlatformWorkspaceBulkDock({
  selectedCount,
  selectedWorkspaces,
  onClearSelection,
  onBulkEnable,
  onBulkDisable,
  busy = false,
}: PlatformWorkspaceBulkDockProps): React.JSX.Element | null {
  const { t } = useTranslation();

  return (
    <StatusBulkActionDock
      selectedCount={selectedCount}
      countLabel={t("platform.workspaces.selectedCount", { count: selectedCount })}
      onClearSelection={onClearSelection}
      clearLabel={t("common.deselect")}
      exportLabel={t("platform.workspaces.exportSelected")}
      enableLabel={t("platform.workspaces.enableSelected")}
      disableLabel={t("platform.workspaces.disableSelected")}
      onExport={() => downloadWorkspacesCsv(selectedWorkspaces)}
      onEnable={() => onBulkEnable(selectedWorkspaces)}
      onDisable={() => onBulkDisable(selectedWorkspaces)}
      busy={busy}
    />
  );
}

import React from "react";
import { Download, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface TasksPageHeaderActionsProps {
  canWrite: boolean;
  canExport?: boolean;
  showDeleted: boolean;
  isExporting?: boolean;
  onCreate: () => void;
  onImport: () => void;
  onExport?: () => void;
}

export function TasksPageHeaderActions({
  canWrite,
  canExport = true,
  showDeleted,
  isExporting = false,
  onCreate,
  onImport,
  onExport,
}: TasksPageHeaderActionsProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (showDeleted || (!canWrite && !(canExport && onExport))) return null;

  return (
    <div className="flex items-center gap-2">
      {canExport && onExport ? (
        <Button
          variant="ghost"
          icon={Download}
          onClick={onExport}
          loading={isExporting}
          disabled={isExporting}
        >
          {t("common.export")}
        </Button>
      ) : null}
      {canWrite ? (
        <>
          <Button variant="outline" icon={Upload} onClick={onImport}>
            {t("common.import")}
          </Button>
          <Button variant="primary" icon={Plus} onClick={onCreate}>
            {t("tasks.create")}
          </Button>
        </>
      ) : null}
    </div>
  );
}

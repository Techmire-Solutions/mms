import React from "react";
import { ClipboardEdit, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface AttendancePageHeaderActionsProps {
  canWrite: boolean;
  canExport?: boolean;
  showDeleted: boolean;
  isExporting?: boolean;
  onMarkAttendance: () => void;
  onImport: () => void;
  onExport?: () => void;
}

export function AttendancePageHeaderActions({
  canWrite,
  canExport = true,
  showDeleted,
  isExporting = false,
  onMarkAttendance,
  onImport,
  onExport,
}: AttendancePageHeaderActionsProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (!canWrite || showDeleted) return null;

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
      <Button variant="outline" icon={Upload} onClick={onImport}>
        {t("common.import")}
      </Button>
      <Button variant="primary" icon={ClipboardEdit} onClick={onMarkAttendance}>
        {t("attendance.tabs.mark")}
      </Button>
    </div>
  );
}

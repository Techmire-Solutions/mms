import React from "react";
import { Download, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface HasanatPageHeaderActionsProps {
  canWrite: boolean;
  canExport?: boolean;
  showDeleted: boolean;
  isExporting?: boolean;
  onDistribute: () => void;
  onImport: () => void;
  onExport?: () => void;
}

export function HasanatPageHeaderActions({
  canWrite,
  canExport = true,
  showDeleted,
  isExporting = false,
  onDistribute,
  onImport,
  onExport,
}: HasanatPageHeaderActionsProps): React.JSX.Element | null {
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
      <Button variant="primary" icon={Send} onClick={onDistribute}>
        {t("hasanat.distributeCards")}
      </Button>
    </div>
  );
}

import { Download, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

interface ObligationsPageActionsProps {
  canWrite: boolean;
  canExport?: boolean;
  showDeleted: boolean;
  isExporting?: boolean;
  onCreate: () => void;
  onImport?: () => void;
  onExport?: () => void;
}

export function ObligationsPageActions({
  canWrite,
  canExport = true,
  showDeleted,
  isExporting = false,
  onCreate,
  onImport,
  onExport,
}: ObligationsPageActionsProps) {
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
      {onImport ? (
        <Button variant="outline" icon={Upload} onClick={onImport}>
          {t("common.import")}
        </Button>
      ) : null}
      <Button variant="primary" icon={Plus} onClick={onCreate}>
        {t("obligations.newCollection")}
      </Button>
    </div>
  );
}

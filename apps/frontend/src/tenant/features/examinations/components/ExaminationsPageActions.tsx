import { Download, PenTool, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface ExaminationsPageActionsProps {
  canWrite: boolean;
  canExport?: boolean;
  showDeleted: boolean;
  isExporting?: boolean;
  onEnterMarks: () => void;
  onCreateExam: () => void;
  onImport?: () => void;
  onExport?: () => void;
}

export function ExaminationsPageActions({
  canWrite,
  canExport = true,
  showDeleted,
  isExporting = false,
  onEnterMarks,
  onCreateExam,
  onImport,
  onExport,
}: ExaminationsPageActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  if (!canWrite || showDeleted) return <div className="flex items-center gap-2" />;

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
      <Button variant="ghost" icon={PenTool} onClick={onEnterMarks}>
        {t("examinations.marks")}
      </Button>
      <Button variant="primary" icon={Plus} onClick={onCreateExam}>
        {t("examinations.newExam")}
      </Button>
    </div>
  );
}

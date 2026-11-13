import { Download, PenTool, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface ExaminationsPageActionsProps {
  /** Marks entry and export: an ordinary `examinations.write` authority. */
  canWrite: boolean;
  /**
   * Exam definition (create) and the exams CSV import: controller authority
   * (`examinations.delete`). Defaults to `canWrite` for callers that do not split them.
   */
  canManage?: boolean;
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
  canManage = canWrite,
  canExport = true,
  showDeleted,
  isExporting = false,
  onEnterMarks,
  onCreateExam,
  onImport,
  onExport,
}: ExaminationsPageActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  if ((!canWrite && !canManage) || showDeleted) return <div className="flex items-center gap-2" />;

  return (
    <div className="flex items-center gap-2">
      {canWrite && canExport && onExport ? (
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
      {canManage && onImport ? (
        <Button variant="outline" icon={Upload} onClick={onImport}>
          {t("common.import")}
        </Button>
      ) : null}
      {canWrite ? (
        <Button variant="ghost" icon={PenTool} onClick={onEnterMarks}>
          {t("examinations.marks")}
        </Button>
      ) : null}
      {canManage ? (
        <Button variant="primary" icon={Plus} onClick={onCreateExam}>
          {t("examinations.newExam")}
        </Button>
      ) : null}
    </div>
  );
}

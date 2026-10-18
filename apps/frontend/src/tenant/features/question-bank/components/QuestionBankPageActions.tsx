import { Download, FileText, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

interface QuestionBankPageActionsProps {
  canWrite: boolean;
  canExport?: boolean;
  showDeleted: boolean;
  isExporting?: boolean;
  onCreatePaper: () => void;
  onAddQuestion: () => void;
  onImport: () => void;
  onExport?: () => void;
}

export function QuestionBankPageActions({
  canWrite,
  canExport = true,
  showDeleted,
  isExporting = false,
  onCreatePaper,
  onAddQuestion,
  onImport,
  onExport,
}: QuestionBankPageActionsProps) {
  const { t } = useTranslation();

  if (!canWrite || showDeleted) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canExport && onExport ? (
        <Button type="button" size="sm" variant="outline" onClick={onExport} disabled={isExporting}>
          <Download className="h-3.5 w-3.5" />
          {t("common.export")}
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="outline" onClick={onImport}>
        <Upload className="h-3.5 w-3.5" />
        {t("common.import")}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onCreatePaper}>
        <FileText className="h-3.5 w-3.5" />
        {t("questionBank.generator")}
      </Button>
      <Button type="button" size="sm" onClick={onAddQuestion}>
        <Plus className="h-3.5 w-3.5" />
        {t("questionBank.addQuestion")}
      </Button>
    </div>
  );
}

import React from "react";
import { Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { startExamResultsExport } from "@/lib/examinations/startExamResultsExport";

/** Import/export actions for one exam's marks (the grid itself owns selection and saving). */
export function EnterMarksTransferActions({
  examId,
  importDisabled,
  onImport,
}: {
  examId: string;
  importDisabled: boolean;
  onImport: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = React.useState(false);

  return (
    <div className="me-auto flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={importDisabled}
        onClick={onImport}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
      >
        <Upload className="w-3.5 h-3.5" aria-hidden="true" />
        {t("common.import")}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={isExporting}
        onClick={() => {
          setIsExporting(true);
          void startExamResultsExport(examId)
            .then(() => notify.success(t("examinations.marksTransfer.exportQueued")))
            .catch((error: Error) => notify.error(error.message))
            .finally(() => setIsExporting(false));
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        {t("common.export")}
      </Button>
    </div>
  );
}

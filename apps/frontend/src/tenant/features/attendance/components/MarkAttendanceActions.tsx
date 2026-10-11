import { Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface MarkAttendanceActionsProps {
  totalRows: number;
  visibleRows: number;
  isOffline: boolean;
  submitted: boolean;
  canWriteAttendance: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

export function MarkAttendanceActions({
  totalRows,
  visibleRows,
  isOffline,
  submitted,
  canWriteAttendance,
  onSaveDraft,
  onSubmit,
}: MarkAttendanceActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <footer className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-xs text-muted-foreground">
        {t("attendance.mark.summary", { total: totalRows, shown: visibleRows })}
      </p>
      <div className="flex gap-2">
        <Button
          onClick={onSaveDraft}
          variant="outline"
          className="flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Save className="w-3.5 h-3.5" aria-hidden="true" /> {t("attendance.mark.saveDraft")}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!canWriteAttendance}
          className="flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
          {isOffline
            ? t("attendance.mark.saveOffline")
            : submitted
              ? t("attendance.mark.updateAttendance")
              : t("attendance.mark.submitAttendance")}
        </Button>
      </div>
    </footer>
  );
}

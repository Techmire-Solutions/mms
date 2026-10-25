import { Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface MarkAttendanceActionsProps {
  totalRows: number;
  visibleRows: number;
  markedCount?: number;
  isOffline: boolean;
  submitted: boolean;
  canWriteAttendance: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

export function MarkAttendanceActions({
  totalRows,
  visibleRows,
  markedCount,
  isOffline,
  submitted,
  canWriteAttendance,
  onSaveDraft,
  onSubmit,
}: MarkAttendanceActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <footer className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {t("attendance.mark.summary", { total: totalRows, shown: visibleRows })}
        </p>
        {markedCount != null && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            {t("attendance.mark.markedProgress", { marked: markedCount, total: totalRows })}
          </span>
        )}
        <span className="text-3xs text-muted-foreground/75 hidden lg:inline">
          {t("attendance.mark.keyboardHints")}
        </span>
      </div>
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

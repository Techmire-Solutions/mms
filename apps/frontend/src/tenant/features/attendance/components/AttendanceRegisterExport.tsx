import { Button } from "@/components/ui/button";
import { todayISO } from "@mms/shared";
import { tsrClient } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";

/** First and last calendar day of a `YYYY-MM` month (date-only math, no timezone drift). */
function monthBounds(month: string): { dateFrom: string; dateTo: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    dateFrom: `${month}-01`,
    dateTo: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

/**
 * Register / monthly-matrix export.
 *
 * Posts the current month (or the selected day's month) for the selected class and lets the queued
 * job produce the artifact — the matrix streams server-side, so nothing is built in the browser.
 */
export function AttendanceRegisterExport({
  classId,
  date,
}: {
  classId?: string;
  date?: string;
}): React.JSX.Element {
  const { t } = useTranslation();
  // `todayISO()` is workspace-local; the old `toISOString()` slice could name the previous month
  // around midnight in a UTC+5 school.
  const month = (date || todayISO()).slice(0, 7);
  const { dateFrom, dateTo } = monthBounds(month);

  const enqueue = tsrClient.attendance.exportMatrix.useMutation({
    onSuccess: () => notify.success(t("attendance.registerExport.queued")),
    onError: (error: unknown) =>
      notify.error(t("attendance.registerExport.failed"), {
        description: error instanceof Error ? error.message : String(error),
      }),
  });

  const submit = (format: "csv" | "xlsx") => {
    if (!classId) {
      notify.error(t("attendance.registerExport.selectClass"));
      return;
    }
    if (dateFrom > dateTo) {
      notify.error(t("attendance.registerExport.failed"));
      return;
    }
    enqueue.mutate({
      body: { classId, dateFrom, dateTo, format },
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        {t("attendance.registerExport.title", { month })}
      </span>
      {!classId ? (
        <span className="text-xs text-muted-foreground">
          {t("attendance.registerExport.selectClass")}
        </span>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={enqueue.isPending || !classId}
        onClick={() => submit("csv")}
      >
        {t("attendance.registerExport.csv")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={enqueue.isPending || !classId}
        onClick={() => submit("xlsx")}
      >
        {t("attendance.registerExport.xlsx")}
      </Button>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { tsrClient } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";

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
  const month = (date || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const dateFrom = `${month}-01`;
  const dateTo = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);

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
    enqueue.mutate({
      body: { classId, dateFrom, dateTo, format },
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        {t("attendance.registerExport.title", { month })}
      </span>
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

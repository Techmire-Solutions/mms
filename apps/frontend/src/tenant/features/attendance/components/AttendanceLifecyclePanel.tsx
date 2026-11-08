import React from "react";
import { AlertTriangle, CalendarCheck2, Check, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/app/SectionCard";
import type { AttendanceLeave } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import type { AttendanceAlertRow } from "@/tenant/features/attendance/hooks/useAttendanceLifecycle";
import {
  useAttendanceAbsenceAlerts,
  useAttendanceExcuses,
} from "@/tenant/features/attendance/hooks/useAttendanceLifecycle";

/**
 * Attendance lifecycle surfaces: the excuse review queue and the chronic-absence alerts.
 *
 * Kept deliberately table-free (cards) so it works on the mobile tier without a second layout; the
 * queue is short by nature (pending requests + open alerts).
 */
export function AttendanceLifecyclePanel(): React.JSX.Element {
  const { t } = useTranslation();
  const excuses = useAttendanceExcuses();
  const absence = useAttendanceAbsenceAlerts();

  const pending = excuses.leaves.filter((leave: AttendanceLeave) => leave.status === "pending");
  const decided = excuses.leaves.filter((leave: AttendanceLeave) => leave.status !== "pending");
  const openAlerts = absence.alerts.filter((alert: AttendanceAlertRow) => alert.status === "open");

  return (
    <div className="space-y-5">
      <SectionCard
        accentColor="primary"
        icon={CalendarCheck2}
        title={t("attendance.excuses.queueTitle")}
        subtitle={t("attendance.excuses.queueDesc")}
      >
        {excuses.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : excuses.isError ? (
          <p className="text-sm text-destructive">{t("attendance.excuses.loadFailed")}</p>
        ) : excuses.leaves.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("attendance.excuses.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {[...pending, ...decided].map((leave) => (
              <li
                key={leave.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{leave.studentId}</p>
                  <p className="text-xs text-muted-foreground">
                    {leave.fromDate} → {leave.toDate} · {leave.leaveType} · {leave.reason}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    pill
                    tone={
                      leave.status === "approved"
                        ? "success"
                        : leave.status === "rejected"
                          ? "destructive"
                          : leave.status === "cancelled"
                            ? "muted"
                            : "warning"
                    }
                  >
                    {t(
                      `attendance.excuses.status.${leave.status}` as "attendance.excuses.status.pending",
                    )}
                  </Badge>
                  {leave.status === "pending" && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={excuses.review.isPending}
                        onClick={() =>
                          excuses.review.mutate({
                            params: { id: leave.id },
                            body: { decision: "approve" },
                          })
                        }
                      >
                        <Check className="me-1 h-4 w-4" aria-hidden="true" />
                        {t("attendance.excuses.approve")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={excuses.review.isPending}
                        onClick={() =>
                          excuses.review.mutate({
                            params: { id: leave.id },
                            body: { decision: "reject" },
                          })
                        }
                      >
                        <X className="me-1 h-4 w-4" aria-hidden="true" />
                        {t("attendance.excuses.reject")}
                      </Button>
                    </>
                  )}
                  {(leave.status === "approved" || leave.status === "pending") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={excuses.cancel.isPending}
                      onClick={() => excuses.cancel.mutate({ params: { id: leave.id }, body: {} })}
                    >
                      {t("attendance.excuses.cancel")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        accentColor="warning"
        icon={AlertTriangle}
        title={t("attendance.alerts.title")}
        subtitle={t("attendance.alerts.desc")}
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={absence.scan.isPending}
            onClick={() => absence.scan.mutate({ body: {} })}
          >
            <RefreshCw className="me-1 h-4 w-4" aria-hidden="true" />
            {t("attendance.alerts.scan")}
          </Button>
        }
      >
        {absence.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : absence.isError ? (
          <p className="text-sm text-destructive">{t("attendance.alerts.loadFailed")}</p>
        ) : openAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("attendance.alerts.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {openAlerts.map((alert) => (
              <li
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{alert.studentId}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("attendance.alerts.streak", {
                      length: String(alert.streakLength),
                      from: alert.streakStart,
                      to: alert.streakEnd,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={absence.resolve.isPending}
                    onClick={() =>
                      absence.resolve.mutate({
                        params: { id: alert.id },
                        body: { status: "resolved" },
                      })
                    }
                  >
                    {t("attendance.alerts.resolve")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={absence.resolve.isPending}
                    onClick={() =>
                      absence.resolve.mutate({
                        params: { id: alert.id },
                        body: { status: "dismissed" },
                      })
                    }
                  >
                    {t("attendance.alerts.dismiss")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

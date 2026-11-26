import React from "react";
import { AlertTriangle, CalendarCheck2, Check, RefreshCw, X } from "lucide-react";
import { Badge } from "@mms/ui";
import { Button } from "@mms/ui";
import { SectionCard } from "@mms/ui";
import type { AttendanceLeave } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";
import type { AttendanceAlertRow } from "../hooks/useAttendanceLifecycle";
import { useAttendanceAbsenceAlerts, useAttendanceExcuses } from "../hooks/useAttendanceLifecycle";
import { AttendanceExcuseForm } from "./AttendanceExcuseForm";
import { AttendanceLifecycleDialogs } from "./AttendanceLifecycleDialogs";

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
  const [showForm, setShowForm] = React.useState(false);
  const [decision, setDecision] = React.useState<{
    leave: AttendanceLeave;
    decision: "approve" | "reject";
  } | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<AttendanceLeave | null>(null);
  const [alertTarget, setAlertTarget] = React.useState<{
    id: string;
    status: "resolved" | "dismissed";
  } | null>(null);

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
        actions={
          <Button type="button" size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            {t("attendance.excuses.new")}
          </Button>
        }
      >
        <AttendanceExcuseForm open={showForm} onClose={() => setShowForm(false)} />
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
                        onClick={() => setDecision({ leave, decision: "approve" })}
                      >
                        <Check className="me-1 h-4 w-4" aria-hidden="true" />
                        {t("attendance.excuses.approve")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={excuses.review.isPending}
                        onClick={() => setDecision({ leave, decision: "reject" })}
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
                      onClick={() => setCancelTarget(leave)}
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
                    onClick={() => setAlertTarget({ id: alert.id, status: "resolved" })}
                  >
                    {t("attendance.alerts.resolve")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={absence.resolve.isPending}
                    onClick={() => setAlertTarget({ id: alert.id, status: "dismissed" })}
                  >
                    {t("attendance.alerts.dismiss")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <AttendanceLifecycleDialogs
        t={t}
        decision={decision}
        cancelTarget={cancelTarget}
        alertTarget={alertTarget}
        onDecisionOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        onCancelOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        onAlertOpenChange={(open) => {
          if (!open) setAlertTarget(null);
        }}
        onReview={async (target, note) => {
          // The dialog must stay open (typed note intact) until the write resolves.
          try {
            await excuses.review.mutateAsync({
              params: { id: target.leave.id },
              body: {
                decision: target.decision,
                ...(note?.trim() ? { note: note.trim() } : {}),
              },
            });
          } catch {
            return false;
          }
          setDecision(null);
          return true;
        }}
        onCancelLeave={async (target, reason) => {
          try {
            await excuses.cancel.mutateAsync({
              params: { id: target.id },
              body: { reason: (reason ?? "").trim() },
            });
          } catch {
            return false;
          }
          setCancelTarget(null);
          return true;
        }}
        onResolveAlert={async (target, note) => {
          try {
            await absence.resolve.mutateAsync({
              params: { id: target.id },
              body: { status: target.status, ...(note?.trim() ? { note: note.trim() } : {}) },
            });
          } catch {
            return false;
          }
          setAlertTarget(null);
          return true;
        }}
        onReasonRequired={() => notify.error(t("attendance.excuses.reasonRequired"))}
      />
    </div>
  );
}

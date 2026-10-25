import React, { useState } from "react";
import { CalendarClock, Ban, CopyPlus } from "lucide-react";
import { canTransitionSession, normalizeSessionStatus, todayISO, type Session } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/FormPrimitives";
import { FormModal } from "@/components/app/FormModal";
import { DatePicker } from "@/components/app/DatePicker";
import { Alert } from "@/components/app/Alert";
import { Textarea } from "@/components/ui/textarea";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { useEnrollmentsCollection } from "@/tenant/hooks/collections/enrollments";
import { NotifyGuardiansButton } from "@/tenant/components/messaging/NotifyGuardiansButton";
import { useSessionLifecycleActions } from "@/tenant/features/sessions/hooks/useSessionLifecycleOps";
import { useSessionRolloverRuns } from "@/tenant/features/sessions/hooks/useSessionRollover";
import { SessionRolloverModal } from "./SessionRolloverModal";

type Action = "cancel" | "postpone";

/** Session-level actions: postpone (before start), cancel, and a guardian notice after cancel. */
export function SessionLifecycleBar({ session }: { session: Session }): React.JSX.Element | null {
  const { t } = useTranslation();
  const [action, setAction] = useState<Action | null>(null);
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const latestRun = useSessionRolloverRuns(String(session.id)).data?.[0];
  const { cancel, postpone, isPending } = useSessionLifecycleActions();
  const state = normalizeSessionStatus(session.status);
  const cancelled = state === "cancelled";
  const studentIds = [
    ...new Set(
      useEnrollmentsCollection({ enabled: cancelled, sessionId: String(session.id) }).map(
        (enrollment) => enrollment.studentId,
      ),
    ),
  ];
  const canPostpone = state === "draft" || state === "open";
  const canCancel = !cancelled && canTransitionSession(session.status, "cancelled");
  const canPromote = state === "in_progress" || state === "completed";

  const open = (next: Action) => {
    setDay(todayISO());
    setReason("");
    setAction(next);
  };
  const reasonValid = reason.trim().length >= 3;
  const submit = async () => {
    const id = String(session.id);
    const saved =
      action === "cancel"
        ? await cancel(id, { reason: reason.trim() })
        : await postpone(id, { startDate: day, reason: reason.trim() });
    if (saved) setAction(null);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {canPostpone ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 gap-1.5"
          onClick={() => open("postpone")}
        >
          <CalendarClock className="size-4" aria-hidden />
          {t("sessions.lifecycleOps.postpone")}
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 gap-1.5 text-destructive"
          onClick={() => open("cancel")}
        >
          <Ban className="size-4" aria-hidden />
          {t("sessions.lifecycleOps.cancel")}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 gap-1.5"
        onClick={() => setRolloverOpen(true)}
      >
        <CopyPlus className="size-4" aria-hidden />
        {t("sessions.rollover.action")}
      </Button>
      {latestRun ? (
        <span role="status" className="self-center text-xs text-muted-foreground">
          {t(`sessions.rollover.run.${latestRun.status}`)}
        </span>
      ) : null}
      {rolloverOpen ? (
        <SessionRolloverModal
          session={session}
          open
          canPromote={canPromote}
          onClose={() => setRolloverOpen(false)}
        />
      ) : null}
      {cancelled ? (
        <NotifyGuardiansButton
          studentIds={studentIds}
          label={t("sessions.lifecycleOps.notifyGuardians")}
          message={t("sessions.lifecycleOps.notifyMessage", { session: session.name })}
        />
      ) : null}
      <FormModal
        open={action !== null}
        onClose={() => setAction(null)}
        title={
          action === "cancel"
            ? t("sessions.lifecycleOps.cancelTitle", { session: session.name })
            : t("sessions.lifecycleOps.postponeTitle", { session: session.name })
        }
        icon={action === "cancel" ? Ban : CalendarClock}
        size="md"
        cancelLabel={t("common.cancel")}
        saveLabel={
          action === "cancel"
            ? t("sessions.lifecycleOps.cancel")
            : t("sessions.lifecycleOps.postpone")
        }
        saving={isPending}
        saveDisabled={isPending || !reasonValid || (action === "postpone" && !day)}
        isDirty={reason.trim().length > 0}
        discardUnsavedTitle={t("settings.unsavedChanges")}
        discardUnsavedDescription={t("enrollments.ops.discardDescription")}
        discardConfirmLabel={t("common.yes")}
        discardCancelLabel={t("common.cancel")}
        onSave={() => void submit()}
      >
        <div className="space-y-4 py-1 text-start">
          <Alert
            density="compact"
            description={
              action === "cancel"
                ? t("sessions.lifecycleOps.cancelHint")
                : t("sessions.lifecycleOps.postponeHint")
            }
          />
          {action === "postpone" ? (
            <Field id="session-postpone-start" label={t("sessions.lifecycleOps.newStart")} required>
              <DatePicker
                id="session-postpone-start"
                name="startDate"
                value={day}
                min={todayISO()}
                disabled={isPending}
                onChange={setDay}
              />
            </Field>
          ) : null}
          <Field
            id="session-lifecycle-reason"
            label={t("enrollments.ops.reason")}
            hint={t("enrollments.ops.reasonHint")}
            error={reason && !reasonValid ? t("enrollments.ops.reasonRequired") : undefined}
            required
          >
            <Textarea
              id="session-lifecycle-reason"
              name="reason"
              className={FORM_INPUT}
              rows={3}
              maxLength={500}
              value={reason}
              disabled={isPending}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        </div>
      </FormModal>
    </div>
  );
}

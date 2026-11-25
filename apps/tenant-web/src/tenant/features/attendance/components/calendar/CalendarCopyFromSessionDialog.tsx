import React, { useMemo, useState } from "react";
import { CopyPlus } from "lucide-react";
import {
  addIsoDays,
  isoDaysBetween,
  type AcademicCalendarEvent,
  type AcademicCalendarEventWrite,
} from "@mms/contracts";
import { Field, FormSelect } from "@mms/fe-core/components/FormPrimitives";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { useTranslation } from "@mms/fe-core/i18n";
import { useIdentityReset } from "@mms/fe-core/forms/useIdentityReset";
import { useDirtySnapshot } from "@mms/fe-core/forms/useDirtySnapshot";
import { mapApiFormError } from "@mms/fe-core/forms/serverFormErrors";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useAcademicCalendarEvents } from "@/tenant/features/attendance/hooks/useAcademicCalendar";

export interface CalendarCopyFromSessionDialogProps {
  open: boolean;
  isPending: boolean;
  onClose: () => void;
  /** Resolves true when every event was created (dialog closes), false to keep it open. */
  onCopy: (bodies: AcademicCalendarEventWrite[]) => Promise<boolean>;
}

/** The state a reopen (or a successful copy) resets to — the dirty baseline. */
const EMPTY_SELECTION = { sourceId: "", targetId: "" };

/** Shifts a session-scoped event onto the target session, preserving its length. */
function shiftEvent(
  event: AcademicCalendarEvent,
  targetSessionId: string,
  days: number,
): AcademicCalendarEventWrite {
  return {
    title: event.title,
    kind: event.kind,
    startOn: addIsoDays(event.startOn, days),
    endOn: addIsoDays(event.endOn, days),
    scope: "session",
    sessionId: targetSessionId,
    classId: null,
    sectionId: null,
    notes: event.notes,
  };
}

/**
 * Attendance → Setup → Calendar: rebuild a new session's calendar from an earlier one.
 *
 * Only events scoped to the source session are copied. Workspace-scoped holidays already apply to
 * every session, so copying them would duplicate them, and class/section scopes point at children
 * the target session does not have. Dates move by the gap between the two session start dates, so
 * a holiday that fell on week three of the old session lands on week three of the new one.
 */
export function CalendarCopyFromSessionDialog({
  open,
  isPending,
  onClose,
  onCopy,
}: CalendarCopyFromSessionDialogProps): React.JSX.Element {
  const { t } = useTranslation();
  const terms = useAcademicTerms();
  const sessions = useSessionsCollection();
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [copyError, setCopyError] = useState<string | null>(null);

  // A cancelled copy must not leave the previous pair selected on reopen.
  useIdentityReset(String(open), () => {
    setSourceId("");
    setTargetId("");
    setCopyError(null);
  });

  const datedSessions = useMemo(
    () => sessions.filter((session) => session.startDate && session.endDate),
    [sessions],
  );
  // Guard the close: picking a source/target pair is unsaved work, so Cancel/Escape asks first.
  const { isDirty } = useDirtySnapshot(
    useMemo(() => ({ sourceId, targetId }), [sourceId, targetId]),
    String(open),
    EMPTY_SELECTION,
  );

  const source = datedSessions.find((session) => session.id === sourceId) ?? null;
  const target = datedSessions.find((session) => session.id === targetId) ?? null;

  const sourceEvents = useAcademicCalendarEvents(
    { from: source?.startDate ?? "", to: source?.endDate ?? "" },
    open && Boolean(source),
  );

  const copyable = useMemo(
    () =>
      (sourceEvents.data ?? []).filter(
        (event) => event.scope === "session" && event.sessionId === sourceId && !event.deletedAt,
      ),
    [sourceEvents.data, sourceId],
  );

  const shift = source && target ? isoDaysBetween(source.startDate, target.startDate) : null;
  const canCopy =
    Boolean(source) &&
    Boolean(target) &&
    sourceId !== targetId &&
    shift !== null &&
    copyable.length > 0;

  const handleCopy = async () => {
    if (!canCopy || !target || shift === null || isPending) return;
    setCopyError(null);
    try {
      const copied = await onCopy(copyable.map((event) => shiftEvent(event, target.id, shift)));
      if (copied) {
        setSourceId("");
        setTargetId("");
        onClose();
      }
    } catch (error) {
      setCopyError(mapApiFormError(error).message ?? t("common.formPleaseFixErrors"));
    }
  };

  const options = datedSessions.map((session) => ({
    value: session.id,
    label: `${session.name} (${session.startDate} – ${session.endDate})`,
  }));

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t("attendance.calendar.copyFromSession")}
      subtitle={t("attendance.calendar.copyFromSessionSubtitle", {
        session: terms.session.singular.toLowerCase(),
      })}
      icon={CopyPlus}
      size="md"
      cancelLabel={t("common.cancel")}
      saveLabel={t("attendance.calendar.copyAction")}
      saving={isPending || sourceEvents.isFetching}
      saveDisabled={isPending || !canCopy}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("common.discardUnsavedDescription")}
      error={copyError ?? undefined}
      onSave={() => void handleCopy()}
      formId="calendar-copy-form"
    >
      <form
        id="calendar-copy-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleCopy();
        }}
      >
        <div className="space-y-4 py-1 text-start">
          {datedSessions.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              {t("attendance.calendar.copyNeedsTwoSessions")}
            </p>
          ) : null}
          <Field label={t("attendance.calendar.copySource")} id="calendar-copy-source" required>
            <FormSelect
              id="calendar-copy-source"
              name="sourceSessionId"
              value={sourceId}
              disabled={isPending}
              onChange={setSourceId}
              options={options.filter((option) => option.value !== targetId)}
              placeholder={t("attendance.calendar.copySelectSession")}
            />
          </Field>
          <Field label={t("attendance.calendar.copyTarget")} id="calendar-copy-target" required>
            <FormSelect
              id="calendar-copy-target"
              name="targetSessionId"
              value={targetId}
              disabled={isPending}
              onChange={setTargetId}
              options={options.filter((option) => option.value !== sourceId)}
              placeholder={t("attendance.calendar.copySelectSession")}
            />
          </Field>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {!source
              ? t("attendance.calendar.copySelectSourceHint")
              : sourceEvents.isPending
                ? t("common.loading")
                : t("attendance.calendar.copyPreview", { count: String(copyable.length) })}
          </p>
        </div>
      </form>
    </FormModal>
  );
}

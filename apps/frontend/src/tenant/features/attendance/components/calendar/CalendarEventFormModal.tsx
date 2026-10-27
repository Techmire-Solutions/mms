import React, { useState, useEffect } from "react";
import { CalendarPlus } from "lucide-react";
import {
  ACADEMIC_CALENDAR_EVENT_KINDS,
  type AcademicCalendarEvent,
  type AcademicCalendarEventKind,
  type AcademicCalendarEventWrite,
} from "@mms/shared";
import { Field, FormSelect } from "@/components/app/FormPrimitives";
import { FormModal } from "@/components/app/FormModal";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/app/DatePicker";
import { useTranslation } from "@/hooks/useTranslation";
import { CalendarEventScopeFields, type CalendarEventScopeValue } from "./CalendarEventScopeFields";

export interface CalendarEventFormModalProps {
  open: boolean;
  /** Event being edited; null creates a new one. */
  entry: AcademicCalendarEvent | null;
  /** Prefill for a new event (e.g. the day clicked in the month view). */
  initialDate?: string;
  isPending: boolean;
  onClose: () => void;
  /** Resolves true when saved (modal closes), false to keep it open. */
  onSave: (body: AcademicCalendarEventWrite) => Promise<boolean>;
}

const EMPTY_SCOPE: CalendarEventScopeValue = {
  scope: "workspace",
  sessionId: "",
  classId: "",
  sectionId: "",
};

/** Create/edit a holiday, make-up day, exam period or event. */
export function CalendarEventFormModal({
  open,
  entry,
  initialDate = "",
  isPending,
  onClose,
  onSave,
}: CalendarEventFormModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<AcademicCalendarEventKind>("holiday");
  const [startOn, setStartOn] = useState("");
  const [endOn, setEndOn] = useState("");
  const [scope, setScope] = useState<CalendarEventScopeValue>(EMPTY_SCOPE);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(entry?.title ?? "");
      setKind(entry?.kind ?? "holiday");
      setStartOn(entry?.startOn ?? initialDate);
      setEndOn(entry?.endOn ?? initialDate);
      setScope(
        entry
          ? {
              scope: entry.scope,
              sessionId: entry.sessionId ?? "",
              classId: entry.classId ?? "",
              sectionId: entry.sectionId ?? "",
            }
          : EMPTY_SCOPE,
      );
      setNotes(entry?.notes ?? "");
    }
  }, [open, entry, initialDate]);

  const rangeInvalid = Boolean(startOn && endOn && endOn < startOn);
  const scopeIncomplete =
    (scope.scope !== "workspace" && !scope.sessionId) ||
    ((scope.scope === "class" || scope.scope === "section") && !scope.classId) ||
    (scope.scope === "section" && !scope.sectionId);
  const canSave = Boolean(title.trim() && startOn && endOn) && !rangeInvalid && !scopeIncomplete;
  const isDirty =
    Boolean(title.trim() || notes.trim()) ||
    (entry !== null &&
      (title !== entry.title || startOn !== entry.startOn || endOn !== entry.endOn));

  const handleSave = async () => {
    if (!canSave) return;
    const saved = await onSave({
      title: title.trim(),
      kind,
      startOn,
      endOn,
      scope: scope.scope,
      sessionId: scope.sessionId || null,
      classId: scope.classId || null,
      sectionId: scope.sectionId || null,
      notes: notes.trim() || null,
    });
    if (saved) onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={entry ? t("attendance.calendar.edit") : t("attendance.calendar.add")}
      subtitle={t("attendance.calendar.formSubtitle")}
      icon={CalendarPlus}
      size="md"
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      saving={isPending}
      saveDisabled={isPending || !canSave}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("attendance.calendar.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      onSave={() => void handleSave()}
    >
      <div className="space-y-4 py-1 text-start">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("attendance.calendar.title")} id="calendar-event-title" required>
            <Input
              id="calendar-event-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={FORM_INPUT}
              maxLength={150}
              disabled={isPending}
            />
          </Field>
          <Field label={t("attendance.calendar.kind")} id="calendar-event-kind" required>
            <FormSelect
              id="calendar-event-kind"
              name="kind"
              value={kind}
              disabled={isPending}
              onChange={(value) =>
                setKind(
                  (ACADEMIC_CALENDAR_EVENT_KINDS as readonly string[]).includes(value)
                    ? (value as AcademicCalendarEventKind)
                    : "holiday",
                )
              }
              options={ACADEMIC_CALENDAR_EVENT_KINDS.map((value) => ({
                value,
                label: t(`attendance.calendar.kinds.${value}`),
              }))}
            />
          </Field>
          <Field label={t("attendance.calendar.startOn")} id="calendar-event-start" required>
            <DatePicker
              id="calendar-event-start"
              name="startOn"
              value={startOn}
              disabled={isPending}
              onChange={(value) => {
                setStartOn(value);
                if (!endOn || endOn < value) setEndOn(value);
              }}
            />
          </Field>
          <Field
            label={t("attendance.calendar.endOn")}
            id="calendar-event-end"
            required
            error={rangeInvalid ? t("attendance.calendar.rangeInvalid") : undefined}
          >
            <DatePicker
              id="calendar-event-end"
              name="endOn"
              value={endOn}
              min={startOn || undefined}
              disabled={isPending}
              aria-invalid={rangeInvalid || undefined}
              onChange={setEndOn}
            />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          {t(`attendance.calendar.kindHints.${kind}`)}
        </p>
        <CalendarEventScopeFields value={scope} onChange={setScope} disabled={isPending} />
        <Field label={t("attendance.calendar.notes")} id="calendar-event-notes">
          <Textarea
            id="calendar-event-notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            disabled={isPending}
          />
        </Field>
      </div>
    </FormModal>
  );
}

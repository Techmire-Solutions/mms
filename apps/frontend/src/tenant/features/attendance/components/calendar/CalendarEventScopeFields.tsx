import React from "react";
import { ACADEMIC_CALENDAR_SCOPES, type AcademicCalendarScope } from "@mms/shared";
import { Field, FormSelect } from "@/components/ui/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { SessionClassSectionSelect } from "@/components/common/SessionClassSectionSelect";

export interface CalendarEventScopeValue {
  scope: AcademicCalendarScope;
  sessionId: string;
  classId: string;
  sectionId: string;
}

export interface CalendarEventScopeFieldsProps {
  value: CalendarEventScopeValue;
  onChange: (next: CalendarEventScopeValue) => void;
  disabled?: boolean;
}

/** Scope cascade for a calendar event: workspace → session → class → section. */
export function CalendarEventScopeFields({ value, onChange, disabled }: CalendarEventScopeFieldsProps): React.JSX.Element {
  const { t } = useTranslation();
  const terms = useAcademicTerms();
  const sessions = useSessionsCollection();
  const needsSession = value.scope !== "workspace";
  const scopeLabel: Record<AcademicCalendarScope, string> = {
    workspace: t("attendance.calendar.scope.workspace"),
    session: terms.session.singular,
    class: terms.class.singular,
    section: terms.section.singular,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="calendar-event-scope" label={t("attendance.calendar.appliesTo")} required>
        <FormSelect
          id="calendar-event-scope"
          name="scope"
          value={value.scope}
          disabled={disabled}
          onChange={(next) => {
            const scope = (ACADEMIC_CALENDAR_SCOPES as readonly string[]).includes(next) ? (next as AcademicCalendarScope) : "workspace";
            onChange({ ...value, scope, ...(scope === "workspace" ? { sessionId: "", classId: "", sectionId: "" } : {}) });
          }}
          options={ACADEMIC_CALENDAR_SCOPES.map((scope) => ({ value: scope, label: scopeLabel[scope] }))}
        />
      </Field>
      {needsSession ? (
        <SessionClassSectionSelect
          sessions={sessions}
          value={value}
          onChange={(next) => onChange({ ...value, ...next })}
          levels={value.scope === "section" ? "section" : value.scope === "class" ? "class" : "session"}
          idPrefix="calendar-event"
          required
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}

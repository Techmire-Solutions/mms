import React from "react";
import type { Session } from "@mms/shared";
import { Field, FormSelect } from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";

export interface SessionClassSectionValue {
  sessionId: string;
  classId: string;
  sectionId: string;
}

export interface SessionClassSectionSelectProps {
  /** Sessions with classes (and sections) — callers load them through their module facade. */
  sessions: readonly Session[];
  value: SessionClassSectionValue;
  onChange: (next: SessionClassSectionValue) => void;
  /** Deepest level shown (session is always shown). */
  levels?: "session" | "class" | "section";
  idPrefix: string;
  required?: boolean;
  disabled?: boolean;
  /** Keeps the session fixed (e.g. a transfer stays inside its session). */
  lockSession?: boolean;
}

/** Cascading session → class → section picker; changing a level clears the levels below it. */
export function SessionClassSectionSelect({
  sessions,
  value,
  onChange,
  levels = "class",
  idPrefix,
  required,
  disabled,
  lockSession,
}: SessionClassSectionSelectProps): React.JSX.Element {
  const { t } = useTranslation();
  const terms = useAcademicTerms();
  const session = sessions.find((row) => row.id === value.sessionId);
  const cls = session?.classes.find((row) => row.id === value.classId);

  return (
    <>
      <Field id={`${idPrefix}-session`} label={terms.session.singular} required={required}>
        <FormSelect
          id={`${idPrefix}-session`}
          name="sessionId"
          value={value.sessionId}
          disabled={disabled || lockSession}
          placeholder={t("common.selectPlaceholder")}
          onChange={(sessionId) => onChange({ sessionId, classId: "", sectionId: "" })}
          options={sessions.map((row) => ({ value: row.id, label: row.name }))}
        />
      </Field>
      {levels !== "session" ? (
        <Field id={`${idPrefix}-class`} label={terms.class.singular} required={required}>
          <FormSelect
            id={`${idPrefix}-class`}
            name="classId"
            value={value.classId}
            disabled={disabled || !session}
            placeholder={t("common.selectPlaceholder")}
            onChange={(classId) => onChange({ ...value, classId, sectionId: "" })}
            options={(session?.classes ?? []).map((row) => ({ value: row.id, label: row.name }))}
          />
        </Field>
      ) : null}
      {levels === "section" ? (
        <Field id={`${idPrefix}-section`} label={terms.section.singular} required={required}>
          <FormSelect
            id={`${idPrefix}-section`}
            name="sectionId"
            value={value.sectionId}
            disabled={disabled || !cls}
            placeholder={t("common.selectPlaceholder")}
            onChange={(sectionId) => onChange({ ...value, sectionId })}
            options={(cls?.sections ?? []).map((row) => ({ value: row.id, label: row.name }))}
          />
        </Field>
      ) : null}
    </>
  );
}

/** Finds the session that owns a class id (for hydrating a picker from a stored class id). */
export function sessionIdForClass(
  sessions: readonly Session[],
  classId: string | null | undefined,
): string {
  if (!classId) return "";
  return sessions.find((session) => session.classes.some((cls) => cls.id === classId))?.id ?? "";
}

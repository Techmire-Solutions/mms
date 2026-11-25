import React from "react";
import type { SessionClassSection } from "@mms/contracts";
import { Field, FormSelect } from "./FormPrimitives.js";
import { useTranslation } from "../i18n/index.js";

export interface SectionFilterFieldProps {
  sections: readonly SessionClassSection[];
  value: string;
  onChange: (sectionId: string) => void;
  id?: string;
  /** Localized label for the section level (from `useAcademicTerms`). */
  sectionLabel: string;
}

/** Section narrowing for class rosters (attendance, exam marks); hidden when fewer than two sections. */
export function SectionFilterField({
  sections,
  value,
  onChange,
  id = "filter-section",
  sectionLabel,
}: SectionFilterFieldProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (sections.length < 2) return null;
  return (
    <Field id={id} label={sectionLabel}>
      <FormSelect
        id={id}
        name="sectionId"
        value={value}
        onChange={onChange}
        placeholder={t("common.allSections")}
        options={sections.map((section) => ({ value: section.id, label: section.name }))}
      />
    </Field>
  );
}

import React from "react";
import type { SessionClassSection } from "@mms/shared";
import { Field, FormSelect } from "@/components/ui/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";

export interface SectionFilterFieldProps {
  sections: readonly SessionClassSection[];
  value: string;
  onChange: (sectionId: string) => void;
  id?: string;
}

/** Section narrowing for class rosters (attendance, exam marks); hidden when fewer than two sections. */
export function SectionFilterField({ sections, value, onChange, id = "filter-section" }: SectionFilterFieldProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const terms = useAcademicTerms();
  if (sections.length < 2) return null;
  return (
    <Field id={id} label={terms.section.singular}>
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

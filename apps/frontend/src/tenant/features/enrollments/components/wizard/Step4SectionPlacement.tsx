import React from "react";
import type { Class } from '@/lib/data/sessionsData';
import { Field, FormSelect } from "@/components/ui/FormPrimitives";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";

export interface SectionPlacement {
  sectionId: string;
  rollNo: string;
}

export interface Step4SectionPlacementProps {
  sessionClass: Class;
  value: SectionPlacement;
  onChange: (value: SectionPlacement) => void;
}

/** First active section with free seats — the default placement for a newly selected class. */
export function defaultSectionId(sessionClass: Class | null | undefined): string {
  const sections = (sessionClass?.sections ?? []).filter((section) => section.status !== 'closed');
  const open = sections.find((section) => (section.enrolled ?? 0) < (section.capacity ?? 0));
  return (open ?? sections[0])?.id ?? '';
}

/** Section + roll number within the chosen class (sections with no seats left are disabled). */
export function Step4SectionPlacement({ sessionClass, value, onChange }: Step4SectionPlacementProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const terms = useAcademicTerms();
  const sections = (sessionClass.sections ?? []).filter((section) => section.status !== 'closed');
  if (sections.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field id="enrollment-section" label={terms.section.singular} required>
        <FormSelect
          id="enrollment-section"
          value={value.sectionId}
          onChange={(sectionId) => onChange({ ...value, sectionId })}
          options={sections.map((section) => {
            const enrolled = section.enrolled ?? 0;
            return { value: section.id, label: `${section.name} (${enrolled}/${section.capacity})` };
          })}
        />
      </Field>
      <Field id="enrollment-roll-no" label={t("enrollments.rollNo")}>
        <Input
          id="enrollment-roll-no"
          value={value.rollNo}
          maxLength={64}
          onChange={(event) => onChange({ ...value, rollNo: event.target.value })}
        />
      </Field>
    </div>
  );
}

import type React from "react";
import { SlidersHorizontal } from "lucide-react";
import type { FieldDefinition, Student } from "@mms/contracts";
import { listEnabledCustomStudentFormFields } from "@mms/contracts";
import { SectionCard } from "@/components/app/SectionCard";
import { RegistryCustomFieldsGrid } from "@/components/app/RegistryCustomFieldsGrid";
import { useTranslation } from "@/hooks/useTranslation";

interface StudentCustomFieldsSectionProps {
  fields: Record<string, FieldDefinition[]>;
  draft: Partial<Student>;
  getFieldError: (fieldId: string) => string | undefined;
  onDraftChange: (patch: Partial<Student>) => void;
}

/** Enabled Setup custom fields for Students, rendered from their registry definitions. */
export function StudentCustomFieldsSection({
  fields,
  draft,
  getFieldError,
  onDraftChange,
}: StudentCustomFieldsSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const customFields = listEnabledCustomStudentFormFields(fields);
  if (customFields.length === 0) return null;

  const errors: Record<string, string> = {};
  for (const field of customFields) {
    const message = getFieldError(field.key);
    if (message) errors[field.key] = message;
  }

  return (
    <SectionCard
      title={t("students.form.customFieldsTitle")}
      icon={SlidersHorizontal}
      accentColor="primary"
    >
      <RegistryCustomFieldsGrid
        fields={customFields}
        values={draft as Record<string, unknown>}
        errors={errors}
        idPrefix="student-custom-field"
        onChange={(key, value) => onDraftChange({ [key]: value } as Partial<Student>)}
      />
    </SectionCard>
  );
}

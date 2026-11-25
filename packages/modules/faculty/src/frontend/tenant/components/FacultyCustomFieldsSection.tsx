import type React from "react";
import { SlidersHorizontal } from "lucide-react";
import { SectionCard } from "@mms/ui";
import { RegistryCustomFieldsGrid } from "@mms/fe-core/components/RegistryCustomFieldsGrid";
import { useTranslation } from "@mms/fe-core/i18n";
import {
  listEnabledCustomFacultyFormFields,
  type FacultyMember,
  type FieldDefinition,
} from "@mms/contracts";

interface FacultyCustomFieldsSectionProps {
  fields: Record<string, FieldDefinition[]>;
  draft: Partial<FacultyMember>;
  errors: Record<string, string>;
  onDraftChange: (patch: Partial<FacultyMember>) => void;
}

export function FacultyCustomFieldsSection({
  fields,
  draft,
  errors,
  onDraftChange,
}: FacultyCustomFieldsSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const customFields = listEnabledCustomFacultyFormFields(fields);
  if (customFields.length === 0) return null;

  return (
    <SectionCard
      title={t("faculty.form.sectionCustom")}
      icon={SlidersHorizontal}
      accentColor="primary"
    >
      <RegistryCustomFieldsGrid
        fields={customFields}
        values={draft as Record<string, unknown>}
        errors={errors}
        idPrefix="faculty-custom-field"
        onChange={(key, value) => onDraftChange({ [key]: value } as Partial<FacultyMember>)}
      />
    </SectionCard>
  );
}

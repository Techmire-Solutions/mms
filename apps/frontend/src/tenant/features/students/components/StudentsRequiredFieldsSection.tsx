import React from "react";
import { ListChecks } from "lucide-react";
import type { AppTranslationKey } from "@mms/contracts";
import { Badge, SectionCard, ToggleRow } from "@mms/ui";
import { ErrorState } from "@/components/app/ErrorState";
import { useTranslation } from "@/hooks/useTranslation";
import type { StudentsRequiredFieldsSetupState } from "@/tenant/features/students/hooks/useStudentsRequiredFieldsSetup";

export interface StudentsRequiredFieldsSectionProps {
  /** Draft + save state owned by the Setup Preferences panel (single footer). */
  state: StudentsRequiredFieldsSetupState;
}

/**
 * Students Setup → Preferences: which contact-profile values must be present before a
 * student can be saved. Rendered as a card; the surrounding panel owns the save footer.
 */
export function StudentsRequiredFieldsSection({
  state,
}: StudentsRequiredFieldsSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  if (state.loadFailed) {
    return <ErrorState title={t("students.setup.requiredFieldsLoadFailed")} />;
  }

  return (
    <SectionCard
      title={t("students.setup.requiredFields")}
      subtitle={t("students.setup.requiredFieldsDescription")}
      icon={ListChecks}
    >
      <ul className="space-y-2">
        {state.rows.map((row) => {
          const label = row.labelKey ? t(row.labelKey as AppTranslationKey) : row.label;
          return (
            <li key={`${row.tabKey}:${row.key}`}>
              <ToggleRow
                variant="bordered"
                ariaLabel={label}
                label={
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{label}</span>
                    {row.recommended ? (
                      <Badge variant="info" size="sm">
                        {t("students.setup.requiredFieldsRecommendedBadge")}
                      </Badge>
                    ) : null}
                    {row.isCustom ? (
                      <Badge variant="outline" size="sm">
                        {t("students.setup.requiredFieldsCustomFieldBadge")}
                      </Badge>
                    ) : null}
                  </span>
                }
                description={
                  row.descriptionKey ? t(row.descriptionKey as AppTranslationKey) : row.description
                }
                checked={row.required}
                onCheckedChange={(next) => state.setRequired(row.key, next)}
                disabled={!state.ready || state.saving}
              />
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

export default StudentsRequiredFieldsSection;

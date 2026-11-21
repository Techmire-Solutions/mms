import React, { useEffect } from "react";
import { ListChecks } from "lucide-react";
import type {
  AppTranslationKey,
  StudentRequirableField,
  StudentRequiredFieldPreset,
} from "@mms/shared";
import { Badge, CompactSegmentedControl, SectionCard, ToggleRow } from "@shared/ui";
import { ErrorState } from "@/components/app/ErrorState";
import { ModuleSetupContent } from "@/components/app/ModuleSetupContent";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { useStudentsRequiredFieldsSetup } from "@/tenant/features/students/hooks/useStudentsRequiredFieldsSetup";

const CONTACT_PROFILE_FIELD_KEYS = new Set(["gender", "dob"]);

export interface StudentsRequiredFieldsSectionProps {
  /** Reports draft dirtiness to the Setup shell (sub-tab leave guard). */
  onDirtyChange?: (isDirty: boolean) => void;
}

function fieldDescription(
  row: StudentRequirableField,
  t: (key: AppTranslationKey) => string,
): string | undefined {
  if (row.key === "grNumber") return t("students.setup.requiredFieldsGrNumberHint");
  if (CONTACT_PROFILE_FIELD_KEYS.has(row.key)) return t("students.setup.requiredFieldsContactHint");
  return undefined;
}

/** Students Setup → Required fields: recommended preset or per-field required/optional. */
export function StudentsRequiredFieldsSection({
  onDirtyChange,
}: StudentsRequiredFieldsSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const state = useStudentsRequiredFieldsSetup();
  const { isDirty } = state;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  if (state.loadFailed) {
    return <ErrorState title={t("students.setup.requiredFieldsLoadFailed")} />;
  }

  const presetOptions: { value: StudentRequiredFieldPreset; label: string }[] = [
    { value: "recommended", label: t("students.setup.requiredFieldsPresetRecommended") },
    { value: "custom", label: t("students.setup.requiredFieldsPresetCustom") },
  ];
  const isCustom = state.preset === "custom";

  return (
    <ModuleSetupContent>
      <SectionCard
        title={t("students.setup.requiredFields")}
        subtitle={t("students.setup.requiredFieldsDescription")}
        icon={ListChecks}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <CompactSegmentedControl
              options={presetOptions}
              value={state.preset}
              onChange={state.selectPreset}
              ariaLabel={t("students.setup.requiredFieldsPresetLabel")}
            />
            <p className="text-sm text-muted-foreground">
              {isCustom
                ? t("students.setup.requiredFieldsCustomHint")
                : t("students.setup.requiredFieldsRecommendedHint")}
            </p>
          </div>

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
                        {row.locked ? (
                          <Badge variant="secondary" size="sm">
                            {t("students.setup.requiredFieldsAlwaysRequired")}
                          </Badge>
                        ) : null}
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
                    description={fieldDescription(row, t)}
                    checked={row.required}
                    onCheckedChange={(next) => state.setRequired(row.key, next)}
                    disabled={row.locked || !isCustom || !state.ready || state.saving}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </SectionCard>

      <ModuleSetupSaveFooter
        dirty={state.isDirty}
        saving={state.saving}
        saved={!state.isDirty}
        disabled={!state.ready}
        unsavedWarning={
          state.isDirty ? t("students.setup.unsavedRequiredFieldsWarning") : undefined
        }
        saveLabel={t("common.save")}
        savedLabel={t("settings.savedBadge")}
        onSave={state.save}
      />
    </ModuleSetupContent>
  );
}

export default StudentsRequiredFieldsSection;

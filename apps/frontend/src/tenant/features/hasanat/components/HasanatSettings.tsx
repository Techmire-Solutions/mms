import React, { useEffect, useState } from "react";
import { hasanatPreferencesPutBodySchema } from "@mms/shared";
import { Star } from "lucide-react";
import { SectionCard } from "@/components/app/SectionCard";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { FORM_INPUT, SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/app/FormSelect";
import { ToggleRow } from "@shared/ui";
import { Field } from "@/components/app/FormPrimitives";
import { useHasanatSetupPanelState } from "@/tenant/features/hasanat/hooks/useHasanatSetupPanelState";
import { ModuleSetupContent } from "@/components/app/ModuleSetupContent";

export interface HasanatSettingsProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const HasanatSettings = function HasanatSettings({
  onPrefsDirtyChange,
}: HasanatSettingsProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { settingsDraft, saved, saving, isPrefsDirty, upd, handleSave } =
    useHasanatSetupPanelState();
  const [pointsError, setPointsError] = useState<string | null>(null);

  // The draft may be 0 (a valid value); only a non-finite entry is invalid. Never mask it with a
  // fallback — the old `|| 10` rendering made a cleared field look like 10.
  const pointsValue = Number.isFinite(settingsDraft.pointsPerUnit)
    ? String(settingsDraft.pointsPerUnit)
    : "";

  const savePreferences = async (): Promise<void> => {
    const parsed = hasanatPreferencesPutBodySchema.safeParse({
      pointsPerUnit: settingsDraft.pointsPerUnit,
      autoApprovePayouts: settingsDraft.autoApprovePayouts,
      defaultViewLayout: settingsDraft.defaultViewLayout,
      awardScope: settingsDraft.awardScope,
    });
    if (!parsed.success || !Number.isFinite(settingsDraft.pointsPerUnit)) {
      setPointsError(t("common.required"));
      return;
    }
    setPointsError(null);
    await handleSave();
  };

  useEffect(() => {
    onPrefsDirtyChange?.(isPrefsDirty);
  }, [isPrefsDirty, onPrefsDirtyChange]);

  const unsavedWarning = isPrefsDirty ? t("hasanat.setup.unsavedPreferencesWarning") : undefined;

  return (
    <ModuleSetupContent>
      <SectionCard
        accentColor="primary"
        icon={Star}
        title={t("hasanat.settings.titlePreferences")}
        className={SETUP_SECTION_CARD_CLASS}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              id="points-per-unit"
              label={t("hasanat.settings.pointsPerUnit")}
              error={pointsError ?? undefined}
            >
              <Input
                id="points-per-unit"
                name="pointsPerUnit"
                type="text"
                inputMode="numeric"
                className={FORM_INPUT}
                value={pointsValue}
                onChange={(event) => {
                  const digits = event.target.value.replace(/[^0-9]/g, "");
                  upd("pointsPerUnit", digits === "" ? 0 : Number(digits));
                  setPointsError(null);
                }}
              />
            </Field>
          </div>
          <Field
            id="award-scope"
            label={t("hasanat.settings.awardScope")}
            hint={t("hasanat.settings.awardScopeHint")}
          >
            <FormSelect
              id="award-scope"
              name="awardScope"
              value={settingsDraft.awardScope ?? "tenant"}
              onChange={(value) =>
                upd("awardScope", value === "assigned_classes" ? "assigned_classes" : "tenant")
              }
              options={[
                { value: "tenant", label: t("hasanat.settings.awardScopeTenant") },
                {
                  value: "assigned_classes",
                  label: t("hasanat.settings.awardScopeAssignedClasses"),
                },
              ]}
            />
          </Field>
          <div className="pt-1">
            <ToggleRow
              label={t("hasanat.settings.autoApprovePayouts")}
              description={t("hasanat.settings.autoApprovePayoutsHint")}
              value={settingsDraft.autoApprovePayouts || false}
              onChange={(value) => upd("autoApprovePayouts", value)}
            />
          </div>
        </div>
        <ModuleSetupSaveFooter
          dirty={isPrefsDirty}
          saving={saving}
          saved={saved}
          saveLabel={saving ? t("global.saving") : t("common.save")}
          savedLabel={t("settings.savedBadge")}
          onSave={() => void savePreferences()}
          disableUnsavedGuard
          footerClassName="mt-4 pt-3"
        />
      </SectionCard>

      <ModuleSetupSaveFooter
        dirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        unsavedWarning={unsavedWarning}
        saveLabel={t("common.save")}
        savedLabel={t("settings.savedBadge")}
        onSave={() => void savePreferences()}
      />
    </ModuleSetupContent>
  );
};

export default HasanatSettings;

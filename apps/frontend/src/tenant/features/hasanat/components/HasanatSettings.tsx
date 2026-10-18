import React, { useEffect } from "react";
import { Star } from "lucide-react";
import { SectionCard } from "@/components/app/SectionCard";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { FORM_INPUT, SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
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
            <Field id="points-per-unit" label={t("hasanat.settings.pointsPerUnit")}>
              <Input
                id="points-per-unit"
                name="pointsPerUnit"
                type="text"
                inputMode="numeric"
                className={FORM_INPUT}
                value={settingsDraft.pointsPerUnit || 10}
                onChange={(event) => upd("pointsPerUnit", Number(event.target.value))}
              />
            </Field>
          </div>
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
          onSave={handleSave}
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
        onSave={handleSave}
      />
    </ModuleSetupContent>
  );
};

export default HasanatSettings;

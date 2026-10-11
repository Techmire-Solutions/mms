import React, { useEffect } from "react";
import { Library } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { ModuleSetupSaveFooter } from "@/components/ui/ModuleSetupSaveFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { FORM_INPUT, SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { ToggleRow } from "@/components/ui/ToggleRow";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/FormPrimitives";
import { CategoryManager } from "@/tenant/features/question-bank/components/CategoryManager";
import { QuestionBankTaxonomySection } from "@/tenant/features/question-bank/components/QuestionBankTaxonomySection";
import { useQuestionBankSetupPanelState } from "@/tenant/features/question-bank/hooks/useQuestionBankSetupPanelState";
import { ModuleSetupContent } from "@/components/ui/ModuleSetupContent";

export interface QuestionBankSettingsProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const QuestionBankSettings = function QuestionBankSettings({
  onPrefsDirtyChange,
}: QuestionBankSettingsProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { settingsDraft, saved, saving, isPrefsDirty, upd, handleSave } =
    useQuestionBankSetupPanelState();

  useEffect(() => {
    onPrefsDirtyChange?.(isPrefsDirty);
  }, [isPrefsDirty, onPrefsDirtyChange]);

  const toggleQuestionType = (questionTypeId: string): void => {
    const types = settingsDraft.questionTypes ?? [];
    const updated = types.map((entry) =>
      entry.id === questionTypeId ? { ...entry, enabled: !entry.enabled } : entry,
    );
    upd("questionTypes", updated);
  };

  const toggleDifficulty = (difficultyId: string): void => {
    const diffs = settingsDraft.difficultyLevels ?? [];
    const updated = diffs.map((entry) =>
      entry.id === difficultyId ? { ...entry, enabled: !entry.enabled } : entry,
    );
    upd("difficultyLevels", updated);
  };

  const unsavedWarning = isPrefsDirty
    ? t("questionBank.setup.unsavedPreferencesWarning")
    : undefined;

  return (
    <ModuleSetupContent>
      <SectionCard
        accentColor="primary"
        icon={Library}
        title={t("questionBank.settingsPrefsTitle")}
        className={SETUP_SECTION_CARD_CLASS}
      >
        <div className="space-y-4">
          <ToggleRow
            label={t("questionBank.aiGrading")}
            description={t("questionBank.aiGradingDesc")}
            value={settingsDraft.aiGrading || false}
            onChange={(value) => upd("aiGrading", value)}
          />

          <Field id="qb-default-duration" label={t("questionBank.defaultDuration")}>
            <Input
              id="qb-default-duration"
              name="defaultTestDuration"
              type="text"
              inputMode="numeric"
              min={5}
              className={FORM_INPUT}
              value={settingsDraft.defaultTestDuration}
              onChange={(event) => upd("defaultTestDuration", Number(event.target.value) || 30)}
            />
          </Field>

          <CategoryManager
            categories={settingsDraft.categories ?? []}
            onChange={(categories) => upd("categories", categories)}
          />

          <QuestionBankTaxonomySection
            questionTypes={settingsDraft.questionTypes}
            difficultyLevels={settingsDraft.difficultyLevels}
            onToggleQuestionType={toggleQuestionType}
            onToggleDifficulty={toggleDifficulty}
          />
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

export default QuestionBankSettings;

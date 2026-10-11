import React, { useEffect } from "react";
import { DollarSign } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { ModuleSetupSaveFooter } from "@/components/ui/ModuleSetupSaveFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { FinancePreferencesSection } from "@/tenant/features/finance/components/FinancePreferencesSection";
import { FinanceInvoiceNumberingSection } from "@/tenant/features/finance/components/FinanceInvoiceNumberingSection";
import { FinanceFeeStructuresSection } from "@/tenant/features/finance/components/FinanceFeeStructuresSection";
import { useFinanceSetupPanelState } from "@/tenant/features/finance/hooks/useFinanceSetupPanelState";
import { ModuleSetupContent } from "@/components/ui/ModuleSetupContent";

export interface FinanceSettingsProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const FinanceSettings = function FinanceSettings({
  onPrefsDirtyChange,
}: FinanceSettingsProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { settings, settingsDraft, saved, saving, isPrefsDirty, upd, handleSave } =
    useFinanceSetupPanelState();

  useEffect(() => {
    onPrefsDirtyChange?.(isPrefsDirty);
  }, [isPrefsDirty, onPrefsDirtyChange]);

  const unsavedWarning = isPrefsDirty ? t("finance.setup.unsavedPreferencesWarning") : undefined;

  return (
    <ModuleSetupContent>
      <SectionCard
        accentColor="primary"
        icon={DollarSign}
        title={t("finance.settings.title")}
        className={SETUP_SECTION_CARD_CLASS}
      >
        <FinancePreferencesSection settings={settings} settingsDraft={settingsDraft} upd={upd} />
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

      <FinanceInvoiceNumberingSection
        settingsDraft={settingsDraft}
        upd={upd}
        isPrefsDirty={isPrefsDirty}
        saving={saving}
        saved={saved}
        onSave={handleSave}
      />

      <FinanceFeeStructuresSection />

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

export default FinanceSettings;

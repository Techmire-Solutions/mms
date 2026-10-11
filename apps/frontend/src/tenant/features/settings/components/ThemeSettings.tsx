import React from "react";
import { Monitor, Box } from "lucide-react";
import {
  cornerStyleLabelKey,
  normalizeBrandingCornerStyle,
  normalizeThemeMode,
  resolveBrandingCornerRadius,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useApplyLogoColors } from "@/tenant/hooks/useApplyLogoColors";
import { useThemeSettingsDraft } from "@/tenant/features/settings/hooks/useThemeSettingsDraft";
import { useSettingsTab } from "@/lib/contexts/SettingsTabContext";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { SettingsFormActions } from "@/components/ui/SettingsFormActions";
import ThemeModeSelector from "@/tenant/features/settings/components/ThemeModeSelector";
import CornerStyleSelector from "@/tenant/features/settings/components/CornerStyleSelector";
import { FieldHint } from "@/components/branding/BrandingShared";
import { SettingsColoursBadge, SettingsPanel } from "@/components/ui/SettingsShell";
import { ThemeSettingsColoursSection } from "@/tenant/features/settings/components/ThemeSettingsColoursSection";
import { ThemeSettingsFooterSection } from "@/tenant/features/settings/components/ThemeSettingsFooterSection";
import { Badge } from "@/components/ui/badge";

/**
 * All visual theming — display mode, brand colours, and footer (single settings tab).
 */
export default function ThemeSettings(): React.JSX.Element {
  const { t } = useTranslation();
  const { setActiveTab } = useSettingsTab();

  const {
    data,
    displayMode,
    setDisplayMode,
    previewMode,
    displayModeSummary,
    isDirty,
    saving,
    saved,
    upd,
    handleSave,
    handleResetToDefaults,
    handleDiscardChanges,
    defaultFooterPreview,
  } = useThemeSettingsDraft(t("theme.savedToast"), t("theme.savedToastDesc"));

  const {
    applying: applyingLogoColors,
    effectiveLogoUrl,
    isSample,
    extractedPalette,
    proportions,
    bestPair,
    apply: applyLogoColors,
    applyBestPair,
    setSampleLogo,
    clearSampleLogo,
  } = useApplyLogoColors({
    logoUrl: data.logoUrl,
    onPrimaryChange: (hex) => upd("primaryColor", hex),
    onSecondaryChange: (hex) => upd("secondaryColor", hex),
  });

  const footerPreview = data.footerText.trim() || defaultFooterPreview;

  return (
    <SettingsPanel
      width="wide"
      introKey="settings.introTheme"
      isDirty={isDirty}
      saved={saved}
      footer={
        <SettingsFormActions
          saveLabel={t("theme.save")}
          savingLabel={t("theme.saving")}
          onSave={() => void handleSave()}
          onDiscard={handleDiscardChanges}
          discardLabel={t("theme.discardChanges")}
          dirty={isDirty}
          saving={saving}
          saved={saved}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetToDefaults}
            disabled={saving}
            className="min-h-11 px-3 text-muted-foreground hover:text-foreground"
          >
            <span>{t("theme.resetDefaults")}</span>
          </Button>
        </SettingsFormActions>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium" aria-live="polite">
        <span className="text-muted-foreground">{t("theme.activeConfig")}:</span>
        <Badge as="span" tone="primary" size="sm">
          {displayModeSummary}
        </Badge>
        <Badge as="span" tone="muted" size="sm">
          {t(cornerStyleLabelKey(normalizeBrandingCornerStyle(data.cornerStyle)), {
            radius: resolveBrandingCornerRadius(normalizeBrandingCornerStyle(data.cornerStyle)),
          })}
        </Badge>
        <SettingsColoursBadge
          primaryColor={data.primaryColor}
          secondaryColor={data.secondaryColor}
          ariaLabel={t("theme.coloursBadge", {
            primary: data.primaryColor,
            accent: data.secondaryColor,
          })}
        />
      </div>

      <SectionCard
        title={t("theme.displayModeTitle")}
        subtitle={t("theme.displayModeDesc")}
        icon={Monitor}
      >
        <ThemeModeSelector
          value={normalizeThemeMode(displayMode)}
          onChange={(mode) => setDisplayMode(normalizeThemeMode(mode))}
        />
      </SectionCard>

      <SectionCard
        title={t("theme.cornerStyleTitle")}
        subtitle={t("theme.cornerStyleDesc")}
        icon={Box}
      >
        <CornerStyleSelector
          value={normalizeBrandingCornerStyle(data.cornerStyle)}
          onChange={(style) => upd("cornerStyle", style)}
        />
        <FieldHint id="corner-style-hint" className="mt-3">
          {t("theme.cornerStyleHint")}
        </FieldHint>
      </SectionCard>

      <ThemeSettingsColoursSection
        t={t}
        logoUrl={effectiveLogoUrl}
        isSample={isSample}
        primaryColor={data.primaryColor}
        secondaryColor={data.secondaryColor}
        previewMode={previewMode}
        extractedPalette={extractedPalette}
        proportions={proportions}
        bestPair={bestPair}
        applyingLogoColors={applyingLogoColors}
        onApplyLogoColors={() => void applyLogoColors()}
        onApplyBestPair={applyBestPair}
        onSetSampleLogo={setSampleLogo}
        onClearSampleLogo={clearSampleLogo}
        onGoToInstitution={() => setActiveTab("branding")}
        onPrimaryChange={(hex) => upd("primaryColor", hex)}
        onSecondaryChange={(hex) => upd("secondaryColor", hex)}
        onApplyPreset={(primary, secondary) => {
          upd("primaryColor", primary);
          upd("secondaryColor", secondary);
        }}
      />

      <ThemeSettingsFooterSection
        t={t}
        footerText={data.footerText}
        footerPreview={footerPreview}
        defaultFooterPreview={defaultFooterPreview}
        logoUrl={data.logoUrl}
        madrasaName={data.madrasaName}
        onFooterChange={(value) => upd("footerText", value)}
        onGenerateFooter={() => upd("footerText", defaultFooterPreview)}
      />
    </SettingsPanel>
  );
}

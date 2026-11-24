import React, { useEffect, useState } from "react";
import { Box, Monitor } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  DEFAULT_PLATFORM_BRANDING,
  formatPlatformFooterDefault,
  normalizeBrandingCornerStyle,
  normalizeThemeMode,
  platformBrandingToBrandingSettings,
  resolveBrandingThemeMode,
} from "@mms/contracts";
import { useTranslation } from "@/hooks/useTranslation";
import { useSystemThemeListener } from "@/hooks/useSystemThemeListener";
import { useApplyLogoColors } from "@/hooks/useApplyLogoColors";
import { useSavedFlash } from "@/hooks/useSavedFlash";
import { SectionCard } from "@/components/app/SectionCard";
import { SettingsFormActions } from "@/components/app/SettingsFormActions";
import { SettingsPanel } from "@/components/app/SettingsShell";
import { FieldHint } from "@/components/branding/BrandingShared";
import ThemeModeSelector from "@/components/branding/ThemeModeSelector";
import CornerStyleSelector from "@/components/branding/CornerStyleSelector";
import { ThemeSettingsColoursSection } from "@/components/branding/ThemeSettingsColoursSection";
import { ThemeSettingsFooterSection } from "@/components/branding/ThemeSettingsFooterSection";
import { Alert } from "@/components/app/Alert";
import { Button, CardSkeleton } from "@mms/ui";
import { applyApexPlatformTheme } from "@/lib/branding/apexPlatformTheme";
import {
  clearPlatformBrandingPreview,
  previewPlatformBranding,
} from "@/lib/branding/platformBrandingStore";
import {
  usePlatformBrandingQuery,
  useUpdatePlatformBranding,
} from "@/platform/features/settings/hooks/usePlatformBrandingData";
import { usePlatformSettingsQuery } from "@/platform/features/settings/hooks/usePlatformSettings";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";
import { PlatformThemeStatusBadges } from "@/platform/features/settings/components/PlatformThemeStatusBadges";
import {
  toPlatformThemeDraft,
  type PlatformThemeDraft,
} from "@/platform/features/settings/lib/platformThemeDraft";

/** Display mode, brand colours, corner roundness, and footer for the apex. */
export default function PlatformThemeSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const [, setSearchParams] = useSearchParams();
  const { data: branding, isLoading, isError, refetch } = usePlatformBrandingQuery();
  const { data: settings } = usePlatformSettingsQuery();
  const updateBranding = useUpdatePlatformBranding();
  const { saved, flashSaved } = useSavedFlash();
  const systemPrefersDark = useSystemThemeListener();
  const [draft, setDraft] = useState<PlatformThemeDraft | null>(null);
  const [prevSource, setPrevSource] = useState<{
    branding: typeof branding;
    settings: typeof settings;
  }>({ branding, settings });
  const [formError, setFormError] = useState<string | null>(null);
  const serverDraft =
    branding && settings ? toPlatformThemeDraft(settings.themeMode, branding) : null;
  const isDirty =
    Boolean(draft && serverDraft) &&
    (draft!.themeMode !== serverDraft!.themeMode ||
      draft!.primaryColor !== serverDraft!.primaryColor ||
      draft!.secondaryColor !== serverDraft!.secondaryColor ||
      draft!.cornerStyle !== serverDraft!.cornerStyle ||
      draft!.footerText !== serverDraft!.footerText);
  if (branding !== prevSource.branding || settings !== prevSource.settings) {
    setPrevSource({ branding, settings });
    if (branding && settings && (!draft || !isDirty))
      setDraft(toPlatformThemeDraft(settings.themeMode, branding));
  }
  const brandingView = draft
    ? platformBrandingToBrandingSettings({
        ...DEFAULT_PLATFORM_BRANDING,
        ...(branding ?? {}),
        ...draft,
        productName: branding?.productName ?? "",
        consoleTitle: branding?.consoleTitle ?? "",
      })
    : null;

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
    logoUrl: branding?.logoUrl ?? "",
    onPrimaryChange: (hex) =>
      setDraft((current) => (current ? { ...current, primaryColor: hex } : current)),
    onSecondaryChange: (hex) =>
      setDraft((current) => (current ? { ...current, secondaryColor: hex } : current)),
  });

  // Live preview — applies unsaved theme values to the document, then restores
  // the persisted branding on cleanup/discard.
  useEffect(() => {
    if (!draft) return;
    previewPlatformBranding(
      {
        primaryColor: draft.primaryColor,
        secondaryColor: draft.secondaryColor,
        cornerStyle: draft.cornerStyle,
        footerText: draft.footerText,
      },
      draft.themeMode,
    );
    applyApexPlatformTheme("en");
    return () => {
      clearPlatformBrandingPreview();
      applyApexPlatformTheme("en");
    };
  }, [draft]);

  if (isLoading || !draft || !brandingView || !branding) return <CardSkeleton count={2} />;
  if (isError) {
    return (
      <Alert
        tone="destructive"
        role="alert"
        description={t("platform.loadFailedHint")}
        action={
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  const defaultFooterPreview = formatPlatformFooterDefault(branding.productName || "MMS", "en");
  const cornerStyle = normalizeBrandingCornerStyle(draft.cornerStyle);

  const handleDiscard = (): void => {
    if (serverDraft) setDraft(serverDraft);
    setFormError(null);
  };

  const handleReset = (): void => {
    setDraft(
      toPlatformThemeDraft("system", {
        primaryColor: DEFAULT_PLATFORM_BRANDING.primaryColor,
        secondaryColor: DEFAULT_PLATFORM_BRANDING.secondaryColor,
        cornerStyle: DEFAULT_PLATFORM_BRANDING.cornerStyle,
        footerText: DEFAULT_PLATFORM_BRANDING.footerText,
      }),
    );
  };

  const handleSave = async (): Promise<void> => {
    setFormError(null);
    try {
      await updateBranding.mutateAsync({
        branding: {
          primaryColor: draft.primaryColor,
          secondaryColor: draft.secondaryColor,
          cornerStyle: draft.cornerStyle,
          footerText: draft.footerText,
        },
        themeMode: draft.themeMode,
        ...(branding.updatedAt ? { expectedUpdatedAt: branding.updatedAt } : {}),
      });
      flashSaved();
    } catch (error) {
      setFormError(getPlatformErrorMessage(error, t, undefined, "platform.loadFailed"));
    }
  };

  return (
    <SettingsPanel
      width="wide"
      introKey="platform.settings.introTheme"
      isDirty={isDirty}
      saved={saved}
      footer={
        <SettingsFormActions
          saveLabel={t("theme.save")}
          savingLabel={t("theme.saving")}
          onSave={() => void handleSave()}
          onDiscard={handleDiscard}
          dirty={isDirty}
          saving={updateBranding.isPending}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={updateBranding.isPending}
            className="min-h-11 px-3 text-muted-foreground hover:text-foreground"
          >
            {t("theme.resetDefaults")}
          </Button>
        </SettingsFormActions>
      }
    >
      <PlatformThemeStatusBadges
        themeMode={draft.themeMode}
        primaryColor={draft.primaryColor}
        secondaryColor={draft.secondaryColor}
        cornerStyle={draft.cornerStyle}
        systemPrefersDark={systemPrefersDark}
      />

      <SectionCard
        title={t("theme.displayModeTitle")}
        subtitle={t("theme.displayModeDesc")}
        icon={Monitor}
      >
        <ThemeModeSelector
          value={draft.themeMode}
          onChange={(mode) =>
            setDraft((current) =>
              current ? { ...current, themeMode: normalizeThemeMode(mode) } : current,
            )
          }
        />
      </SectionCard>

      <SectionCard
        title={t("theme.cornerStyleTitle")}
        subtitle={t("theme.cornerStyleDesc")}
        icon={Box}
      >
        <CornerStyleSelector
          value={cornerStyle}
          onChange={(style) =>
            setDraft((current) => (current ? { ...current, cornerStyle: style } : current))
          }
        />
        <FieldHint id="corner-style-hint" className="mt-3">
          {t("theme.cornerStyleHint")}
        </FieldHint>
      </SectionCard>

      <ThemeSettingsColoursSection
        t={t}
        logoUrl={effectiveLogoUrl}
        isSample={isSample}
        primaryColor={draft.primaryColor}
        secondaryColor={draft.secondaryColor}
        previewMode={resolveBrandingThemeMode(draft.themeMode, systemPrefersDark)}
        extractedPalette={extractedPalette}
        proportions={proportions}
        bestPair={bestPair}
        applyingLogoColors={applyingLogoColors}
        onApplyLogoColors={() => void applyLogoColors()}
        onApplyBestPair={applyBestPair}
        onSetSampleLogo={setSampleLogo}
        onClearSampleLogo={clearSampleLogo}
        onGoToInstitution={() =>
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("section", "branding");
            return next;
          })
        }
        onPrimaryChange={(hex) =>
          setDraft((current) => (current ? { ...current, primaryColor: hex } : current))
        }
        onSecondaryChange={(hex) =>
          setDraft((current) => (current ? { ...current, secondaryColor: hex } : current))
        }
        onApplyPreset={(primary, secondary) =>
          setDraft((current) =>
            current ? { ...current, primaryColor: primary, secondaryColor: secondary } : current,
          )
        }
      />

      <ThemeSettingsFooterSection
        t={t}
        footerText={draft.footerText}
        footerPreview={draft.footerText.trim() || defaultFooterPreview}
        defaultFooterPreview={defaultFooterPreview}
        logoUrl={branding.logoUrl}
        madrasaName={branding.productName || "MMS"}
        onFooterChange={(value) =>
          setDraft((current) => (current ? { ...current, footerText: value } : current))
        }
        onGenerateFooter={() =>
          setDraft((current) =>
            current ? { ...current, footerText: defaultFooterPreview } : current,
          )
        }
      />

      {formError ? (
        <Alert tone="destructive" density="compact" role="alert" description={formError} />
      ) : null}
    </SettingsPanel>
  );
}

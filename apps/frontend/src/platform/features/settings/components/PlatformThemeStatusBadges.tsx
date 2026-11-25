import React from "react";
import {
  cornerStyleLabelKey,
  formatThemeDisplayModeSummary,
  normalizeBrandingCornerStyle,
  resolveBrandingCornerRadius,
  resolveBrandingThemeMode,
  type ThemeMode,
} from "@mms/contracts";
import { useTranslation } from "@/hooks/useTranslation";
import { SettingsColoursBadge } from "@/components/app/SettingsShell";
import { Badge } from "@mms/ui";

export interface PlatformThemeStatusBadgesProps {
  themeMode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  cornerStyle: string;
  systemPrefersDark: boolean;
}

/** Active theme summary chips for the platform Theme tab. */
export function PlatformThemeStatusBadges({
  themeMode,
  primaryColor,
  secondaryColor,
  cornerStyle: cornerStyleInput,
  systemPrefersDark,
}: PlatformThemeStatusBadgesProps): React.JSX.Element {
  const { t } = useTranslation();
  const previewMode = resolveBrandingThemeMode(themeMode, systemPrefersDark);
  const displayModeSummary = formatThemeDisplayModeSummary(themeMode, previewMode, "en");
  const cornerStyle = normalizeBrandingCornerStyle(cornerStyleInput);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-medium" aria-live="polite">
      <span className="text-muted-foreground">{t("theme.activeConfig")}:</span>
      <Badge as="span" tone="primary" size="sm">
        {displayModeSummary}
      </Badge>
      <Badge as="span" tone="muted" size="sm">
        {t(cornerStyleLabelKey(cornerStyle), {
          radius: resolveBrandingCornerRadius(cornerStyle),
        })}
      </Badge>
      <SettingsColoursBadge
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        ariaLabel={t("theme.coloursBadge", {
          primary: primaryColor,
          accent: secondaryColor,
        })}
      />
    </div>
  );
}

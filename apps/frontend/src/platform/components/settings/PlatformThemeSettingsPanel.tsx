import { usePlatformThemePreview } from "@/platform/hooks/usePlatformThemePreview";
import { MMS_PLATFORM_BRANDING } from "@/platform/lib/themeScope";
import React from "react";
import { Palette, Sun, Moon, Monitor } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { THEME_MODE_OPTIONS } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor };

export function PlatformThemeSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const { selectedMode, setSelectedMode } = usePlatformThemePreview();

  return (
    <div className="space-y-6 text-start">
      <Card className="rounded-xl border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            {t("theme.cornerPreviewTitle")}
          </CardTitle>
          <CardDescription className="text-xs">{t("theme.primaryColourDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {THEME_MODE_OPTIONS.map((opt) => {
              const Icon = THEME_ICONS[opt.value];
              const isSelected = selectedMode === opt.value;
              return (
                <Button
                  key={opt.value}
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedMode(opt.value)}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl border text-center h-auto transition-colors cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 font-semibold text-primary"
                      : "border-border/60 hover:bg-muted/40 text-muted-foreground",
                  )}
                  aria-pressed={isSelected}
                >
                  <Icon className="w-6 h-6 mb-2" />
                  <span className="text-xs">{t(opt.labelKey)}</span>
                </Button>
              );
            })}
          </div>

          <div className="space-y-3 pt-2 border-t border-border/50">
            <p className="text-xs font-medium">{t("theme.swatchesTitle")}</p>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-11 w-11 shrink-0 rounded-full bg-primary" />
                <div>
                  <dt className="text-xs">{t("theme.primaryColourLabel")}</dt>
                  <dd className="text-xs font-mono text-muted-foreground">
                    {MMS_PLATFORM_BRANDING.primaryColor}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-11 w-11 shrink-0 rounded-full bg-secondary" />
                <div>
                  <dt className="text-xs">{t("theme.accentColourLabel")}</dt>
                  <dd className="text-xs font-mono text-muted-foreground">
                    {MMS_PLATFORM_BRANDING.secondaryColor}
                  </dd>
                </div>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useState } from "react";
import { AlertTriangle, Check, Plus } from "lucide-react";
import { BRANDING_THEME_PRESETS, meetsWcagAaUiContrast, type BrandingThemeMode } from "@mms/shared";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

import {
  loadCustomPresets,
  presetPrimaryContrast,
  saveCustomPresets,
  type CustomThemePreset,
} from "./brandColorPanelShared";
import { BrandSaveCustomPresetModal } from "./BrandSaveCustomPresetModal";
import { BrandCustomPresetsGrid } from "./BrandCustomPresetsGrid";

interface BrandPresetPickerProps {
  primaryColor: string;
  secondaryColor: string;
  previewMode: BrandingThemeMode;
  onApplyPreset: (primary: string, secondary: string) => void;
}

export function BrandPresetPicker({
  primaryColor,
  secondaryColor,
  previewMode,
  onApplyPreset,
}: BrandPresetPickerProps) {
  const { t } = useTranslation();
  const [customPresets, setCustomPresets] = useState<CustomThemePreset[]>(loadCustomPresets);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetNameDraft, setPresetNameDraft] = useState("");

  const handleOpenSaveDialog = (): void => {
    setPresetNameDraft(`${t("theme.customPresetDefaultName")} ${customPresets.length + 1}`);
    setIsSavingPreset(true);
  };

  const handleConfirmSavePreset = (): void => {
    if (!presetNameDraft.trim()) return;

    const newPreset: CustomThemePreset = {
      id: `custom-${Date.now()}`,
      name: presetNameDraft.trim(),
      primaryColor,
      secondaryColor,
    };
    const updated = [...customPresets.slice(-3), newPreset];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    setIsSavingPreset(false);
    notify.success(t("theme.customPresetSaved"));
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    const updated = customPresets.filter((p) => p.id !== id);
    setCustomPresets(updated);
    saveCustomPresets(updated);
    notify.success(t("theme.customPresetDeleted"));
  };

  return (
    <div className="space-y-3">
      <BrandSaveCustomPresetModal
        open={isSavingPreset}
        onClose={() => setIsSavingPreset(false)}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        presetNameDraft={presetNameDraft}
        onPresetNameDraftChange={setPresetNameDraft}
        onSave={handleConfirmSavePreset}
        t={t}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("theme.palettesTitle")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("theme.palettesDesc")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleOpenSaveDialog}
          className="min-h-11 px-3 text-xs"
        >
          <Plus className="h-3.5 w-3.5 me-1" />
          {t("theme.saveCustomPreset")}
        </Button>
      </div>

      <BrandCustomPresetsGrid
        customPresets={customPresets}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        onApplyPreset={onApplyPreset}
        onDeleteCustom={handleDeleteCustom}
        t={t}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {BRANDING_THEME_PRESETS.map((preset) => {
          const active =
            primaryColor === preset.primaryColor && secondaryColor === preset.secondaryColor;
          const presetContrast = presetPrimaryContrast(
            preset.primaryColor,
            preset.secondaryColor,
            previewMode,
          );
          const lowContrast = presetContrast !== null && !meetsWcagAaUiContrast(presetContrast);
          return (
            <Button
              key={preset.id}
              type="button"
              variant="ghost"
              onClick={() => onApplyPreset(preset.primaryColor, preset.secondaryColor)}
              className={cn(
                "h-auto min-h-11 flex items-center justify-start gap-2.5 rounded-xl border p-2.5 text-start transition-all hover:border-primary/40",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-muted/20 hover:bg-muted/30",
              )}
            >
              <span
                className="relative h-9 w-9 shrink-0 rounded-full border border-white/20 shadow-xs"
                style={{ backgroundColor: preset.primaryColor }}
              >
                <span
                  className="absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full border-2 border-background"
                  style={{ backgroundColor: preset.secondaryColor }}
                  aria-hidden
                />
                {active ? (
                  <Check
                    className="absolute inset-0 m-auto h-4 w-4 text-background drop-shadow-sm"
                    aria-hidden
                  />
                ) : null}
                {lowContrast ? (
                  <AlertTriangle
                    className="absolute -start-1 -top-1 h-3.5 w-3.5 text-warning drop-shadow-sm dark:text-warning"
                    aria-label={t("theme.presetContrastLow")}
                  />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-foreground">
                  {t(preset.labelKey)}
                </span>
                <span className="block truncate font-mono text-2xs text-muted-foreground">
                  {preset.primaryColor}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

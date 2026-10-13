import { useState, useEffect, useRef } from "react";
import type { LogoColorProportion } from "@mms/shared";
import { extractLogoBrandColors } from "@/lib/ui/extractLogoBrandColors";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";

interface UseApplyLogoColorsOptions {
  logoUrl: string;
  onPrimaryChange: (hex: string) => void;
  onSecondaryChange: (hex: string) => void;
}

export interface UseApplyLogoColorsResult {
  applying: boolean;
  effectiveLogoUrl: string;
  isSample: boolean;
  extractedPalette: readonly string[];
  proportions: readonly LogoColorProportion[];
  bestPair: { primary: string; secondary: string } | null;
  apply: () => Promise<void>;
  applyBestPair: () => void;
  setSampleLogo: (dataUrl: string) => void;
  clearSampleLogo: () => void;
  clearPalette: () => void;
}

export function useApplyLogoColors({
  logoUrl,
  onPrimaryChange,
  onSecondaryChange,
}: UseApplyLogoColorsOptions): UseApplyLogoColorsResult {
  const { t } = useTranslation();
  const [applying, setApplying] = useState(false);
  const [sampleLogoUrl, setSampleLogoUrl] = useState<string | null>(null);
  const [extractedPalette, setExtractedPalette] = useState<readonly string[]>([]);
  const [proportions, setProportions] = useState<readonly LogoColorProportion[]>([]);
  const [bestPair, setBestPair] = useState<{ primary: string; secondary: string } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const autoExtractedRef = useRef<string>("");

  const effectiveLogoUrl = sampleLogoUrl || logoUrl.trim();
  const isSample = Boolean(sampleLogoUrl);

  // Auto-extract swatches silently in background when logo changes
  useEffect(() => {
    if (!effectiveLogoUrl || autoExtractedRef.current === effectiveLogoUrl) return;
    autoExtractedRef.current = effectiveLogoUrl;

    const controller = new AbortController();
    void extractLogoBrandColors(effectiveLogoUrl, { signal: controller.signal })
      .then((colors) => {
        if (controller.signal.aborted || !colors) return;
        setExtractedPalette(colors.palette ?? []);
        setProportions(colors.proportions ?? []);
        setBestPair({ primary: colors.primaryColor, secondary: colors.secondaryColor });
      })
      .catch(() => {
        // Silent catch for background preview
      });

    return () => {
      controller.abort();
    };
  }, [effectiveLogoUrl]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const clearPalette = () => {
    setExtractedPalette([]);
    setProportions([]);
    setBestPair(null);
  };

  const setSampleLogo = (dataUrl: string) => {
    setSampleLogoUrl(dataUrl);
  };

  const clearSampleLogo = () => {
    setSampleLogoUrl(null);
  };

  const applyBestPair = () => {
    if (!bestPair) return;
    onPrimaryChange(bestPair.primary);
    onSecondaryChange(bestPair.secondary);
    notify.success(t("theme.logoColorsApplied"), { description: t("theme.logoColorsAppliedDesc") });
  };

  const apply = async (): Promise<void> => {
    if (applying) return;
    if (!effectiveLogoUrl) {
      notify.error(t("theme.logoColorsMissing"), { description: t("theme.logoColorsMissingDesc") });
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setApplying(true);
    try {
      const colors = await extractLogoBrandColors(effectiveLogoUrl, { signal: controller.signal });
      if (controller.signal.aborted) return;

      if (!colors) {
        notify.error(t("theme.logoColorsFailed"), { description: t("theme.logoColorsFailedDesc") });
        return;
      }
      onPrimaryChange(colors.primaryColor);
      onSecondaryChange(colors.secondaryColor);
      setExtractedPalette(colors.palette ?? []);
      setProportions(colors.proportions ?? []);
      setBestPair({ primary: colors.primaryColor, secondary: colors.secondaryColor });
      notify.success(t("theme.logoColorsApplied"), {
        description: t("theme.logoColorsAppliedDesc"),
      });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "name" in err && err.name === "AbortError") return;
      notify.error(t("theme.logoColorsFailed"));
    } finally {
      if (controllerRef.current === controller) {
        setApplying(false);
        controllerRef.current = null;
      }
    }
  };

  return {
    applying,
    effectiveLogoUrl,
    isSample,
    extractedPalette,
    proportions,
    bestPair,
    apply,
    applyBestPair,
    setSampleLogo,
    clearSampleLogo,
    clearPalette,
  };
}

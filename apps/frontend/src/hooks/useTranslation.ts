import { useContext } from "react";
import { TranslationContext, type TranslationFunction } from "@/lib/contexts/TranslationContext";

/**
 * Reactive app-wide UI translations.
 * - Platform apex: always English (LTR).
 * - Missing/disabled tenant hosts: always English (platform status screens).
 * - Tenant auth entry (login / 2FA / forgot): English.
 * - Authenticated tenant app: workspace language preference.
 */
export function useTranslation(): {
  language: string;
  t: TranslationFunction;
  isLoading: boolean;
  dir: "ltr" | "rtl";
  isRtl: boolean;
} {
  const context = useContext(TranslationContext);
  if (!context) {
    return {
      language: "en",
      t: ((key: string, _params?: Record<string, string | number>) => key) as TranslationFunction,
      isLoading: false,
      dir: "ltr",
      isRtl: false,
    };
  }
  return {
    language: context.language,
    t: context.t,
    isLoading: context.isLoading,
    dir: context.dir,
    isRtl: context.isRtl,
  };
}

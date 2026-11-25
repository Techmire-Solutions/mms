import { useMemo } from "react";
import {
  ACADEMIC_TERM_KEYS,
  resolveAcademicTerm,
  type AcademicTermKey,
  type AcademicTermLabel,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useSessionConfig } from "@/hooks/useStandardModuleConfig";

export type AcademicTerms = Record<AcademicTermKey, AcademicTermLabel>;

/**
 * Tenant labels for Session / Class / Section in the active language
 * (Sessions → Setup → Terminology), falling back to the translation pack.
 */
export function useAcademicTerms(): AcademicTerms {
  const { t, language } = useTranslation();
  const { settings } = useSessionConfig();
  const terminology = settings.terminology;

  return useMemo(() => {
    const terms = {} as AcademicTerms;
    for (const key of ACADEMIC_TERM_KEYS) {
      terms[key] = resolveAcademicTerm(terminology, language, key, {
        singular: t(`academicTerms.${key}.singular`),
        plural: t(`academicTerms.${key}.plural`),
      });
    }
    return terms;
  }, [terminology, language, t]);
}

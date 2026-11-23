import { useMemo, type Dispatch, type SetStateAction } from "react";
import { type OnboardingData } from "@/platform/features/onboarding/OnboardingWizard";
import {
  slugifySubdomain,
  SYSTEM_MODULES,
  getRecommendedModulesForIndustry,
  type IndustryType,
} from "@mms/shared";
import { getAppDomain } from "@/lib/config/tenantConfig";
import { useTranslation } from "@/hooks/useTranslation";
import { NAME_MAX } from "@/components/branding/BrandingShared";
import { usePlatformModuleCatalogQuery } from "@/platform/features/settings/hooks/usePlatformModules";

export function useCreateMadrasaController(
  data: OnboardingData,
  onChange: Dispatch<SetStateAction<OnboardingData>>,
) {
  const { t } = useTranslation();
  const appDomain = getAppDomain();
  const { data: moduleCatalog } = usePlatformModuleCatalogQuery();

  const availableModules = useMemo(() => {
    if (!moduleCatalog) return SYSTEM_MODULES;
    return SYSTEM_MODULES.filter((module) => {
      const entry = moduleCatalog.find((candidate) => candidate.id === module.id);
      return entry ? entry.platformEnabled || Boolean(module.required) : false;
    });
  }, [moduleCatalog]);
  const availableModuleIds = useMemo(
    () => new Set(availableModules.map((module) => module.id)),
    [availableModules],
  );
  const requiredIds = useMemo(
    () => availableModules.filter((module) => module.required).map((module) => module.id),
    [availableModules],
  );

  /** Replaces the module selection, marking it user-edited so catalog seeding stops. */
  const setModules = (moduleIds: string[]): void => {
    const filtered = Array.from(
      new Set([...requiredIds, ...moduleIds.filter((id) => availableModuleIds.has(id))]),
    );
    onChange((prev) => ({ ...prev, modules: filtered, modulesTouched: true }));
  };

  const updateField = <K extends keyof OnboardingData>(field: K, fieldValue: OnboardingData[K]) => {
    onChange((prev) => ({ ...prev, [field]: fieldValue }));
  };

  const handleNameChange = (nameValue: string) => {
    onChange((prev) => ({
      ...prev,
      name: nameValue.slice(0, NAME_MAX),
      subdomain: prev.subdomainTouched ? prev.subdomain : slugifySubdomain(nameValue),
    }));
  };

  const handleSubdomainChange = (subdomainValue: string) => {
    onChange((prev) => ({
      ...prev,
      subdomain: slugifySubdomain(subdomainValue),
      subdomainTouched: true,
    }));
  };

  const handleIndustryChange = (industry: IndustryType) => {
    const recommended = getRecommendedModulesForIndustry(industry).filter((id) =>
      availableModuleIds.has(id),
    );
    setModules([...requiredIds, ...recommended]);
    onChange((prev) => ({ ...prev, industryType: industry }));
  };

  return {
    t,
    appDomain,
    data,
    onChange,
    availableModules,
    setModules,
    updateField,
    handleNameChange,
    handleSubdomainChange,
    handleIndustryChange,
  };
}

export type CreateMadrasaController = ReturnType<typeof useCreateMadrasaController>;

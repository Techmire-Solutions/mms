import type React from "react";
import { lazy, type LazyExoticComponent } from "react";
import type { SettingsSection } from "@/lib/config/routes";

const GlobalSettings = lazy(() => import("@/tenant/features/settings/components/GlobalSettings"));
const SystemModulesSettings = lazy(
  () => import("@/tenant/features/settings/components/SystemModulesSettings"),
);
const BrandingSettings = lazy(
  () => import("@/tenant/features/settings/components/BrandingSettings"),
);
const ThemeSettings = lazy(() => import("@/tenant/features/settings/components/ThemeSettings"));
const BackupRestore = lazy(() => import("@/tenant/features/settings/components/BackupRestore"));
const LlmSettings = lazy(() => import("@/tenant/features/settings/components/LlmSettings"));

export const SETTINGS_SECTION_COMPONENTS: Record<
  SettingsSection,
  LazyExoticComponent<React.ComponentType>
> = {
  global: GlobalSettings,
  modules: SystemModulesSettings,
  branding: BrandingSettings,
  theme: ThemeSettings,
  backup: BackupRestore,
  llm: LlmSettings,
};

import type React from "react";
import { lazy, type LazyExoticComponent } from "react";
import type { PlatformSettingsSection } from "@/platform/features/settings/lib/platformSettingsNavConfig";

const PlatformGeneralSettingsPanel = lazy(
  () => import("@/platform/features/settings/components/PlatformGeneralSettingsPanel"),
);
const PlatformBrandingSettingsPanel = lazy(
  () => import("@/platform/features/settings/components/PlatformBrandingSettingsPanel"),
);
const PlatformThemeSettingsPanel = lazy(
  () => import("@/platform/features/settings/components/PlatformThemeSettingsPanel"),
);
const PlatformModulesSettingsPanel = lazy(
  () => import("@/platform/features/settings/components/PlatformModulesSettingsPanel"),
);
const PlatformLlmSettingsPanel = lazy(
  () => import("@/platform/features/settings/components/PlatformLlmSettingsPanel"),
);
const PlatformBackupSettingsPanel = lazy(
  () => import("@/platform/features/settings/components/PlatformBackupSettingsPanel"),
);

export const PLATFORM_SETTINGS_SECTION_COMPONENTS: Record<
  PlatformSettingsSection,
  LazyExoticComponent<React.ComponentType>
> = {
  global: PlatformGeneralSettingsPanel,
  branding: PlatformBrandingSettingsPanel,
  theme: PlatformThemeSettingsPanel,
  modules: PlatformModulesSettingsPanel,
  llm: PlatformLlmSettingsPanel,
  backup: PlatformBackupSettingsPanel,
};

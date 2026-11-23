import type { PlatformSettings } from "@mms/shared";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { platformSettingsEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Returns an i18n-resolved EntityDescriptor<PlatformSettings> for
 * platform settings inspection and configuration.
 */
export function usePlatformSettingsDescriptor(): EntityDescriptor<PlatformSettings> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(
    platformSettingsEntityDescriptor,
    (key, fallback) => t(key as Parameters<typeof t>[0]) || fallback,
  );
}

export const usePlatformSettingsEntityDescriptor = usePlatformSettingsDescriptor;

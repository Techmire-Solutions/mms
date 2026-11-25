import type { PlatformSettings } from "@mms/contracts";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import { platformSettingsEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@mms/fe-core/components/useStaticEntityDescriptor";
import { useTranslation } from "@mms/fe-core/i18n";

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

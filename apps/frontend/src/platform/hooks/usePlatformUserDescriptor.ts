import type { PlatformUserProfile } from "@mms/shared";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { platformUsersEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Returns an i18n-resolved EntityDescriptor<PlatformUserProfile> for
 * platform admin user management tables and drawers.
 */
export function usePlatformUserDescriptor(): EntityDescriptor<PlatformUserProfile> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(
    platformUsersEntityDescriptor,
    (key, fallback) => t(key as Parameters<typeof t>[0]) || fallback,
  );
}

export const usePlatformUsersEntityDescriptor = usePlatformUserDescriptor;

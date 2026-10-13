import type { SystemUser } from "@mms/shared";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { usersEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Returns an i18n-resolved EntityDescriptor<SystemUser> with all labels
 * resolved through the active locale at call time.
 */
export function useUsersEntityDescriptor(): EntityDescriptor<SystemUser> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(
    usersEntityDescriptor,
    (key, fallback) => t(key as Parameters<typeof t>[0]) || fallback,
  );
}

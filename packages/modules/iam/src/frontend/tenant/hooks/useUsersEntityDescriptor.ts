import type { SystemUser } from "@mms/contracts";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import { usersEntityDescriptor } from "../lib/usersDescriptor";
import { useStaticEntityDescriptor } from "@mms/fe-core/components/useStaticEntityDescriptor";
import { useTranslation } from "@mms/fe-core/i18n";

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

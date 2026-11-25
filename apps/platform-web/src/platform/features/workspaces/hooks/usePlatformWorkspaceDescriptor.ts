import type { PlatformWorkspaceRow } from "@mms/contracts";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import { platformWorkspacesEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@mms/fe-core/components/useStaticEntityDescriptor";
import { useTranslation } from "@mms/fe-core/i18n";

/**
 * Returns an i18n-resolved EntityDescriptor<PlatformWorkspaceRow> for
 * platform workspace management tables and drawers.
 *
 * Platform apex is English-only today; t() is used for forward-compatibility
 * should the platform ever support localization.
 */
export function usePlatformWorkspaceDescriptor(): EntityDescriptor<PlatformWorkspaceRow> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(platformWorkspacesEntityDescriptor, (key, fallback) => {
    const res = t(key as Parameters<typeof t>[0]);
    return res && res !== key ? res : fallback;
  });
}

export const usePlatformWorkspacesEntityDescriptor = usePlatformWorkspaceDescriptor;

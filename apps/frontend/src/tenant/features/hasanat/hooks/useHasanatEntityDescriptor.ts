import type { Distribution } from "@mms/shared";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { hasanatEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Returns an i18n-resolved EntityDescriptor<Distribution> with all labels
 * resolved through the active locale at call time.
 */
export function useHasanatEntityDescriptor(): EntityDescriptor<Distribution> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(
    hasanatEntityDescriptor,
    (key, fallback) => t(key as Parameters<typeof t>[0]) || fallback,
  );
}

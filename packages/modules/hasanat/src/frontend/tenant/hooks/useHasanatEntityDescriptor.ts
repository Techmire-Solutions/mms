import type { Distribution } from "@mms/contracts";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import { useStaticEntityDescriptor } from "@mms/fe-core/components/useStaticEntityDescriptor";
import { useTranslation } from "@mms/fe-core/i18n";
import { hasanatEntityDescriptor } from "../lib/hasanatEntityDescriptor.js";

/**
 * Returns an i18n-resolved EntityDescriptor<Distribution> with all labels
 * resolved through the active locale at call time.
 */
export function useHasanatEntityDescriptor(): EntityDescriptor<Distribution> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(
    hasanatEntityDescriptor,
    (key: string, fallback: string) => t(key as Parameters<typeof t>[0]) || fallback,
  );
}

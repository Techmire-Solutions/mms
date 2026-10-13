import type { ObligationCollection } from "@mms/shared";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { obligationsEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Returns an i18n-resolved EntityDescriptor<ObligationCollection> with all labels
 * resolved through the active locale at call time.
 */
export function useObligationEntityDescriptor(): EntityDescriptor<ObligationCollection> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(
    obligationsEntityDescriptor,
    (key, fallback) => t(key as Parameters<typeof t>[0]) || fallback,
  );
}

export const useObligationsEntityDescriptor = useObligationEntityDescriptor;

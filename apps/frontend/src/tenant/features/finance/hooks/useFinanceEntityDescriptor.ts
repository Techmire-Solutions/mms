import type { Invoice } from "@mms/shared";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { financeEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Returns an i18n-resolved EntityDescriptor<Invoice> with all labels
 * resolved through the active locale at call time.
 */
export function useFinanceEntityDescriptor(): EntityDescriptor<Invoice> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(
    financeEntityDescriptor,
    (key, fallback) => t(key as Parameters<typeof t>[0]) || fallback,
  );
}

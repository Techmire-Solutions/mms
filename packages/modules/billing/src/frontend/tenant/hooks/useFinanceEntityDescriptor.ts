import type { Invoice } from "@mms/contracts";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import { financeEntityDescriptor } from "../lib/financeDescriptors";
import { useStaticEntityDescriptor } from "@mms/fe-core/components/useStaticEntityDescriptor";
import { useTranslation } from "@mms/fe-core/i18n";

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

import { useCallback } from "react";
import type { ObligationCollection } from "@mms/contracts";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import { obligationsEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@mms/fe-core/i18n";

/**
 * Returns an i18n-resolved EntityDescriptor<ObligationCollection> with all labels
 * resolved through the active locale at call time.
 */
export function useObligationEntityDescriptor(): EntityDescriptor<ObligationCollection> {
  const { t } = useTranslation();
  // Stable resolver so the underlying `useStaticEntityDescriptor` memo keeps its
  // result instead of re-resolving every field on each render.
  const resolveLabel = useCallback(
    (key: string, fallback: string) => t(key as Parameters<typeof t>[0]) || fallback,
    [t],
  );
  return useStaticEntityDescriptor(obligationsEntityDescriptor, resolveLabel);
}

export const useObligationsEntityDescriptor = useObligationEntityDescriptor;

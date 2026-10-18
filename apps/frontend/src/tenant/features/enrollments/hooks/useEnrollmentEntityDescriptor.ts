import type { Enrollment } from "@mms/shared";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { enrollmentsEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Returns an i18n-resolved EntityDescriptor<Enrollment> with all labels
 * resolved through the active locale at call time.
 */
export function useEnrollmentEntityDescriptor(): EntityDescriptor<Enrollment> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(
    enrollmentsEntityDescriptor,
    (key, fallback) => t(key as Parameters<typeof t>[0]) || fallback,
  );
}

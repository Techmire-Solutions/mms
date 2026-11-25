import type { Enrollment } from "@mms/contracts";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import { enrollmentsEntityDescriptor } from "../lib/enrollmentDescriptors";
import { useStaticEntityDescriptor } from "@mms/fe-core/components/useStaticEntityDescriptor";
import { useTranslation } from "@mms/fe-core/i18n";

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

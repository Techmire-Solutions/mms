import type { AttendanceRecord } from "@mms/shared";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { attendanceEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Returns an i18n-resolved EntityDescriptor<AttendanceRecord> with all labels
 * resolved through the active locale at call time.
 */
export function useAttendanceEntityDescriptor(): EntityDescriptor<AttendanceRecord> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(
    attendanceEntityDescriptor,
    (key, fallback) => t(key as Parameters<typeof t>[0]) || fallback,
  );
}

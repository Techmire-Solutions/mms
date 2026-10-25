import React from "react";
import { CalendarOff } from "lucide-react";
import { Alert } from "@/components/app/Alert";
import { useTranslation } from "@/hooks/useTranslation";
import type { InstructionalDayStatus } from "@/tenant/features/attendance/hooks/useInstructionalDayStatus";

export interface MarkAttendanceHolidayBannerProps {
  status: InstructionalDayStatus;
}

/** Explains why marking is blocked (or allowed as an extra class) on a non-teaching day. */
export function MarkAttendanceHolidayBanner({
  status,
}: MarkAttendanceHolidayBannerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (status.instructional || status.isLoading) return null;
  const reason = status.event?.title ?? t("attendance.calendar.weeklyOffDay");
  return (
    <Alert
      icon={CalendarOff}
      tone={status.allowExtraClass ? "info" : "warning"}
      role="status"
      title={t("attendance.calendar.nonTeachingDayTitle", { reason })}
      description={
        status.allowExtraClass
          ? t("attendance.calendar.extraClassAllowed")
          : t("attendance.calendar.markingBlocked")
      }
    />
  );
}

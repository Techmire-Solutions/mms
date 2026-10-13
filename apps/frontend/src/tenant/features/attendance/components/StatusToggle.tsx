import React from "react";
import { useAttendanceConfig } from "@/hooks/useStandardModuleConfig";
import type { AttendanceStatus } from "@/lib/data/attendanceData";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import type { AppTranslationKey } from "@mms/shared";
import { attendanceStatusLabel } from "@/lib/ui/attendanceStatusUi";

export interface StatusToggleProps {
  value: string;
  onChange: (status: string) => void;
}

/**
 * StatusToggle
 *
 * Provides a button group to toggle between different attendance statuses.
 *
 * @param props - The component props.
 * @returns The rendered toggle component.
 */
export function StatusToggle({ value, onChange }: StatusToggleProps): React.JSX.Element {
  const { statuses } = useAttendanceConfig();
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("attendance.filter.status")}
      className="flex max-w-full overflow-x-auto rounded-lg border border-border text-xs font-bold"
    >
      {statuses.map((status: AttendanceStatus) => {
        const title = attendanceStatusLabel(status, t);
        const shortKey = `attendance.status.${status.id}.short` as AppTranslationKey;
        const short = t(shortKey);

        return (
          <Button
            key={status.id}
            type="button"
            onClick={() => onChange(status.id)}
            title={title}
            aria-pressed={value === status.id}
            variant="ghost"
            className={`shrink-0 px-2.5 py-1.5 transition-colors rounded-none min-h-11 ${
              value === status.id
                ? `${status.bg} ${status.text} hover:${status.bg} hover:${status.text}`
                : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {short === shortKey ? status.short : short}
          </Button>
        );
      })}
    </div>
  );
}

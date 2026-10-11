import { useTranslation } from "@/hooks/useTranslation";
import { attendanceStatusLabel } from "@/lib/attendanceStatusUi";
import type { AttendanceStatus } from "@/lib/data/attendanceData";

export interface MarkAttendanceStatsStripProps {
  statuses: AttendanceStatus[];
  stats: Record<string, number>;
}

export function MarkAttendanceStatsStrip({
  statuses,
  stats,
}: MarkAttendanceStatsStripProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-autofit-md">
      {statuses.map((status) => (
        <div
          key={status.id}
          className={`min-w-0 rounded-xl ${status.bg} ${status.text} border ${status.border} px-3 py-2 text-center`}
        >
          <p className="text-lg font-bold">{stats[status.id] || 0}</p>
          <p className="text-xs font-semibold truncate">{attendanceStatusLabel(status, t)}</p>
        </div>
      ))}
    </div>
  );
}

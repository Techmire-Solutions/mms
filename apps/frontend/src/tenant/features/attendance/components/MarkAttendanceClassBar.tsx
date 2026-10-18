import { CheckCircle2, Scan, WifiOff, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import type { AttendanceRecord } from "@/lib/data/attendanceData";
import { MarkAttendanceGeoTag } from "@/tenant/features/attendance/components/MarkAttendanceGeoTag";
import type { GeoData } from "@/tenant/features/attendance/lib/markAttendanceTypes";

export interface AttendanceClassSummary {
  name?: string;
  facultyName?: string;
}

export interface AttendanceSessionSummary {
  name?: string;
}

export interface MarkAttendanceClassBarProps {
  classInfo?: AttendanceClassSummary;
  sessionInfo?: AttendanceSessionSummary | null;
  date: string;
  submitted: boolean;
  isOffline: boolean;
  isDraft: boolean;
  geo: GeoData | "loading" | null;
  onRequestGeo: () => void;
  onToggleFaceAI: () => void;
  onMarkAll: (status: AttendanceRecord["status"]) => void;
}

export function MarkAttendanceClassBar({
  classInfo,
  sessionInfo,
  date,
  submitted,
  isOffline,
  isDraft,
  geo,
  onRequestGeo,
  onToggleFaceAI,
  onMarkAll,
}: MarkAttendanceClassBarProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-foreground m-0">{classInfo?.name}</h2>
          {submitted && (
            <Badge pill tone="success" className="gap-1 px-2 font-bold bg-success/15">
              <CheckCircle2 className="w-2.5 h-2.5" aria-hidden="true" />{" "}
              {t("attendance.mark.submitted")}
            </Badge>
          )}
          {isOffline && (
            <Badge pill tone="warning" className="gap-1 px-2 font-bold bg-warning/15">
              <WifiOff className="w-2.5 h-2.5" aria-hidden="true" /> {t("attendance.mark.offline")}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {sessionInfo?.name} · {classInfo?.facultyName} · {date}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <MarkAttendanceGeoTag geo={geo} onRequest={onRequestGeo} />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {isDraft && (
          <span className="px-2 py-1 rounded-lg bg-warning/15 text-warning text-xs font-bold">
            {t("attendance.mark.draftSaved")}
          </span>
        )}
        <Button
          onClick={onToggleFaceAI}
          variant="outline"
          size="sm"
          className="flex min-h-11 items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Scan className="w-3 h-3" aria-hidden="true" /> {t("attendance.mark.faceAi")}
        </Button>
        <div
          className="flex max-w-full overflow-x-auto rounded-lg border border-border text-xs font-semibold"
          role="group"
          aria-label={t("attendance.mark.bulkActionsAria")}
        >
          <Button
            onClick={() => onMarkAll("present")}
            variant="ghost"
            className="shrink-0 min-h-11 px-3 py-2 rounded-none bg-success/10 text-success hover:bg-success/15 hover:text-success transition-colors flex items-center gap-1 font-semibold"
          >
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />{" "}
            {t("attendance.mark.allPresent")}
          </Button>
          <Button
            onClick={() => onMarkAll("absent")}
            variant="ghost"
            className="shrink-0 min-h-11 px-3 py-2 rounded-none bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive transition-colors flex items-center gap-1 font-semibold"
          >
            <XCircle className="w-3 h-3" aria-hidden="true" /> {t("attendance.mark.allAbsent")}
          </Button>
        </div>
      </div>
    </header>
  );
}

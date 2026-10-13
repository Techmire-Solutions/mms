import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import type { GeoData } from "@/tenant/features/attendance/lib/markAttendanceTypes";

export interface MarkAttendanceGeoTagProps {
  geo: GeoData | "loading" | null;
  onRequest: () => void;
}

export function MarkAttendanceGeoTag({
  geo,
  onRequest,
}: MarkAttendanceGeoTagProps): React.JSX.Element {
  const { t } = useTranslation();
  if (geo === "loading")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium px-2 py-1 rounded-lg bg-muted animate-pulse">
        <MapPin className="w-3 h-3" aria-hidden="true" /> {t("attendance.mark.gettingLocation")}
      </span>
    );
  if (geo)
    return (
      <span className="flex items-center gap-1 text-xs text-success font-medium px-2 py-1 rounded-lg bg-success/10 border border-success/30">
        <MapPin className="w-3 h-3" aria-hidden="true" /> {geo.lat.toFixed(4)}, {geo.lng.toFixed(4)}
      </span>
    );
  return (
    <Button
      onClick={onRequest}
      variant="outline"
      size="sm"
      className="flex min-h-11 items-center gap-1 text-xs text-muted-foreground font-medium px-2 py-2 rounded-lg border border-dashed border-border hover:bg-muted hover:text-muted-foreground transition-colors bg-transparent"
    >
      <MapPin className="w-3 h-3" aria-hidden="true" /> {t("attendance.mark.tagLocation")}
    </Button>
  );
}

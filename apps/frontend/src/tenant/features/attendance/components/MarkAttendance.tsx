import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { SearchBar } from "@/components/app/SearchBar";
import { MarkAttendanceActions } from "@/tenant/features/attendance/components/MarkAttendanceActions";
import { MarkAttendanceClassBar } from "@/tenant/features/attendance/components/MarkAttendanceClassBar";
import { MarkAttendanceFacePlaceholder } from "@/tenant/features/attendance/components/MarkAttendanceFacePlaceholder";
import { MarkAttendanceGrid } from "@/tenant/features/attendance/components/MarkAttendanceGrid";
import { MarkAttendanceHolidayBanner } from "@/tenant/features/attendance/components/MarkAttendanceHolidayBanner";
import { useInstructionalDayStatus } from "@/tenant/features/attendance/hooks/useInstructionalDayStatus";
import { useMarkAttendanceKeyboardShortcuts } from "@/tenant/features/attendance/hooks/useMarkAttendanceKeyboardShortcuts";
import { MarkAttendanceOfflineBanner } from "@/tenant/features/attendance/components/MarkAttendanceOfflineBanner";
import { MarkAttendanceStatsStrip } from "@/tenant/features/attendance/components/MarkAttendanceStatsStrip";
import { getAuditLog } from "@/tenant/features/attendance/lib/markAttendanceQueue";
import type { MarkAttendanceProps } from "@/tenant/features/attendance/lib/markAttendanceTypes";
import { useMarkAttendanceController } from "@/tenant/features/attendance/hooks/useMarkAttendanceController";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { notify } from "@/lib/notify";
import type { AttendanceRecord } from "@/lib/data/attendanceData";

export type {
  AuditEntry,
  AttendanceRow,
  GeoData,
  OfflinePayload,
} from "@/tenant/features/attendance/lib/markAttendanceTypes";
export { getAuditLog };

export function MarkAttendance(props: MarkAttendanceProps): React.JSX.Element {
  // A save that would override a lock or the cut-off needs a recorded justification: the API
  // refuses it once, this dialog collects the reason and retries the same save.
  const [override, setOverride] = useState<{
    records: AttendanceRecord[];
    retry: (reason: string) => Promise<void>;
  } | null>(null);
  const controller = useMarkAttendanceController({
    ...props,
    onOverrideRequired: (records, retry) => setOverride({ records, retry }),
  });
  const dayStatus = useInstructionalDayStatus({
    date: controller.filters.date,
    sessionId: controller.sessionInfo?.id,
    classId: controller.filters.classId,
    sectionId: controller.filters.sectionId,
    sessionWorkingDays: controller.sessionInfo?.workingDays,
  });
  const dayAllowsMarking = dayStatus.instructional || dayStatus.allowExtraClass;
  const markedCount = useMemo(
    () => controller.rows.filter((r) => Boolean(r.status)).length,
    [controller.rows],
  );

  useMarkAttendanceKeyboardShortcuts({
    enabled: true,
    canWrite: controller.canWriteAttendance && dayAllowsMarking,
    onMarkAll: controller.markAll,
    onSaveDraft: () => void controller.handleSaveDraft(),
    onSubmit: () => void controller.handleSubmit(),
  });

  const confirmOverride = async (reason?: string): Promise<boolean> => {
    const trimmed = (reason ?? "").trim();
    if (trimmed.length < 3) {
      notify.error(controller.t("attendance.override.required"));
      return false;
    }
    const pending = override;
    setOverride(null);
    if (pending) await pending.retry(trimmed);
    return true;
  };

  if (!controller.filters.classId) {
    return (
      <EmptyState
        title={controller.t("attendance.mark.selectClassTitle")}
        description={controller.t("attendance.mark.selectClassDesc")}
        icon={Users}
      />
    );
  }

  return (
    <section className="space-y-4">
      <MarkAttendanceOfflineBanner
        offline={controller.isOffline}
        queue={controller.offlineQueue}
        onSync={() => void controller.handleSync()}
      />
      {controller.syncedMsg && (
        <div className="px-4 py-2 rounded-xl bg-success/10 border border-success/30 text-success text-sm font-semibold">
          ✓ {controller.t("attendance.mark.syncSuccess")}
        </div>
      )}

      <AnimatePresence>
        {controller.showFaceAI && (
          <MarkAttendanceFacePlaceholder onClose={() => controller.setShowFaceAI(false)} />
        )}
      </AnimatePresence>

      <MarkAttendanceHolidayBanner status={dayStatus} />

      <MarkAttendanceClassBar
        classInfo={controller.classInfo}
        sessionInfo={controller.sessionInfo}
        date={controller.filters.date}
        submitted={controller.submitted}
        isOffline={controller.isOffline}
        isDraft={controller.isDraft}
        geo={controller.geo}
        onRequestGeo={controller.requestGeo}
        onToggleFaceAI={() => controller.setShowFaceAI((isOpen) => !isOpen)}
        onMarkAll={controller.markAll}
      />

      <MarkAttendanceStatsStrip statuses={controller.statuses} stats={controller.stats} />

      <SearchBar
        id="attendance-search-student"
        name="studentSearch"
        value={controller.search}
        onChange={controller.setSearch}
        placeholder={controller.t("attendance.searchStudent")}
        className="w-full"
      />

      <MarkAttendanceGrid
        rows={controller.filteredRows}
        orderedFields={controller.orderedFields}
        statuses={controller.statuses}
        isFieldEnabled={controller.isFieldEnabled}
        onFieldChange={controller.setRow}
      />

      <MarkAttendanceActions
        totalRows={controller.rows.length}
        visibleRows={controller.filteredRows.length}
        markedCount={markedCount}
        isOffline={controller.isOffline}
        submitted={controller.submitted}
        canWriteAttendance={controller.canWriteAttendance && dayAllowsMarking}
        onSaveDraft={() => void controller.handleSaveDraft()}
        onSubmit={() => void controller.handleSubmit()}
      />

      <ConfirmAlertDialog
        open={override !== null}
        onOpenChange={(open) => {
          if (!open) setOverride(null);
        }}
        title={controller.t("attendance.override.title")}
        description={controller.t("attendance.override.description")}
        confirmLabel={controller.t("attendance.override.confirm")}
        cancelLabel={controller.t("common.cancel")}
        onConfirm={confirmOverride}
        optionalReason={{
          label: controller.t("attendance.override.reasonLabel"),
          placeholder: controller.t("attendance.override.reasonPlaceholder"),
        }}
      />
    </section>
  );
}

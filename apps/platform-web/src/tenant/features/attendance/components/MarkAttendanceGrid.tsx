import React, { useCallback, useMemo } from "react";
import { Card } from "@mms/ui";
import { useListRowMotion } from "@mms/fe-core/hooks";
import { useWorkDirectoryViewMode, type WorkDirectoryViewMode } from "@mms/fe-core/tenant";
import type { ModuleFieldDef } from "@mms/contracts";
import type { AttendanceStatus } from "@/lib/data/attendanceData";
import type { AttendanceRow } from "../lib/markAttendanceTypes";
import { MarkAttendanceCardsView } from "./MarkAttendanceCardsView";
import { MarkAttendanceTableView } from "./MarkAttendanceTableView";
import { useRosterRowNavigation } from "@/tenant/features/attendance/hooks/useRosterRowNavigation";
import type { AttendanceRecord } from "@/lib/data/attendanceData";

export interface MarkAttendanceGridProps {
  rows: AttendanceRow[];
  orderedFields: ModuleFieldDef[];
  statuses: AttendanceStatus[];
  isFieldEnabled: (fieldId: string) => boolean;
  onFieldChange: (studentId: string, key: string, value: unknown) => void;
  /** Keyboard row navigation target (digits/space/arrows operate on the active row). */
  onSetStatus?: (studentId: string, status: AttendanceRecord["status"]) => void;
  viewMode?: WorkDirectoryViewMode;
}

export function MarkAttendanceGrid({
  rows,
  orderedFields,
  statuses,
  isFieldEnabled,
  onFieldChange,
  onSetStatus,
  viewMode: propViewMode,
}: MarkAttendanceGridProps): React.JSX.Element {
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;
  const rowMotion = useListRowMotion({ layout: true });
  // `enabledFields` participates in the memoized table columns — recompute it only when the field
  // config or the enabled set changes, not on every keystroke.
  const enabledFields = useMemo(
    () => orderedFields.filter((field) => isFieldEnabled(field.id)),
    [orderedFields, isFieldEnabled],
  );
  // Stable per roster change: Space advances from the row's CURRENT status (not always "absent").
  const getStatus = useCallback(
    (studentId: string) => rows.find((row) => row.studentId === studentId)?.status,
    [rows],
  );
  const navigation = useRosterRowNavigation({
    enabled: Boolean(onSetStatus),
    studentIds: useMemo(() => rows.map((row) => row.studentId), [rows]),
    onSetStatus: onSetStatus ?? (() => {}),
    getStatus,
  });

  return (
    <Card accentColor="primary" className="p-0 overflow-hidden">
      {viewMode === "cards" ? (
        <MarkAttendanceCardsView
          rows={rows}
          enabledFields={enabledFields}
          statuses={statuses}
          onFieldChange={onFieldChange}
          rowMotion={() => rowMotion()}
          activeStudentId={navigation.activeStudentId}
        />
      ) : (
        <MarkAttendanceTableView
          rows={rows}
          enabledFields={enabledFields}
          statuses={statuses}
          onFieldChange={onFieldChange}
          activeStudentId={navigation.activeStudentId}
        />
      )}
    </Card>
  );
}

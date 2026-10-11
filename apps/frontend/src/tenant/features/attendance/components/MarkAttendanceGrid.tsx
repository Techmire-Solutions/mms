import React from "react";
import { Card } from "@/components/ui/card";
import { useListRowMotion } from "@/hooks/useListRowMotion";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";
import type { ModuleFieldDef } from "@mms/shared";
import type { AttendanceStatus } from "@/lib/data/attendanceData";
import type { AttendanceRow } from "./markAttendanceTypes";
import { MarkAttendanceCardsView } from "./MarkAttendanceCardsView";
import { MarkAttendanceTableView } from "./MarkAttendanceTableView";

export interface MarkAttendanceGridProps {
  rows: AttendanceRow[];
  orderedFields: ModuleFieldDef[];
  statuses: AttendanceStatus[];
  isFieldEnabled: (fieldId: string) => boolean;
  onFieldChange: (studentId: string, key: string, value: unknown) => void;
  viewMode?: WorkDirectoryViewMode;
}

export function MarkAttendanceGrid({
  rows,
  orderedFields,
  statuses,
  isFieldEnabled,
  onFieldChange,
  viewMode: propViewMode,
}: MarkAttendanceGridProps): React.JSX.Element {
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;
  const rowMotion = useListRowMotion({ layout: true });
  const enabledFields = orderedFields.filter((field) => isFieldEnabled(field.id));

  return (
    <Card accentColor="primary" className="p-0 overflow-hidden">
      {viewMode === "cards" ? (
        <MarkAttendanceCardsView
          rows={rows}
          enabledFields={enabledFields}
          statuses={statuses}
          onFieldChange={onFieldChange}
          rowMotion={() => rowMotion()}
        />
      ) : (
        <MarkAttendanceTableView
          rows={rows}
          enabledFields={enabledFields}
          statuses={statuses}
          onFieldChange={onFieldChange}
        />
      )}
    </Card>
  );
}

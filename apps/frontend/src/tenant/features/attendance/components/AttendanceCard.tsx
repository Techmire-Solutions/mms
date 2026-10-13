import type React from "react";
import { formatDate } from "@mms/shared";
import { TimePicker } from "@/components/app/TimePicker";
import { EntityCardMetaTile } from "@/components/app/EntityCardMetaTile";
import { EntityCard } from "@/components/app/EntityCard";
import { DirectoryCard } from "@/components/app/DirectoryCard";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/data/attendanceData";
import { AttendanceRecordStatusCell } from "./AttendanceRecordStatusCell";

export interface AttendanceCardProps {
  attendanceRecord: AttendanceRecord;
  isColumnVisible: (key: string) => boolean;
  editingRecord: AttendanceRecord | null;
  statuses: AttendanceStatus[];
  updateDraft: <K extends keyof AttendanceRecord>(key: K, value: AttendanceRecord[K]) => void;
  renderRowActions: (record: AttendanceRecord) => React.ReactNode;
  classLabel: (classId: string) => string;
  selectedIds: string[];
  canDelete: boolean;
  onToggleSelectedRecord: (id: string, checked: boolean) => void;
  reducedMotion: boolean;
  t: TranslationFunction;
}

const getAttendanceAccentClass = (status?: string): string => {
  if (status === "present") return "bg-success/60 group-hover:bg-success";
  if (status === "absent") return "bg-destructive/60 group-hover:bg-destructive";
  if (status === "late") return "bg-warning/60 group-hover:bg-warning";
  if (status === "excused") return "bg-info/60 group-hover:bg-info";
  return "bg-primary/50 group-hover:bg-primary";
};

/** Work directory card — DirectoryCard SSOT (do not hand-compose EntityCard). */
export function AttendanceCard({
  attendanceRecord,
  isColumnVisible,
  editingRecord,
  statuses,
  updateDraft,
  renderRowActions,
  classLabel,
  selectedIds,
  canDelete,
  onToggleSelectedRecord,
  reducedMotion,
  t,
}: AttendanceCardProps): React.JSX.Element {
  return (
    <DirectoryCard
      entity={attendanceRecord}
      selectedIds={selectedIds}
      canSelect={canDelete}
      onToggleSelected={onToggleSelectedRecord}
      reducedMotion={reducedMotion}
      accentClassName={getAttendanceAccentClass(attendanceRecord.status)}
      header={{
        displayName: attendanceRecord.studentName,
        subtitle: isColumnVisible("class") ? (
          <p className="truncate text-xs text-muted-foreground">
            {classLabel(attendanceRecord.classId)}
          </p>
        ) : undefined,
      }}
      metadataSlot={
        <EntityCard.MetaGrid>
          {isColumnVisible("date") && (
            <EntityCardMetaTile label={t("attendance.columns.date")}>
              <span className="font-mono">{formatDate(attendanceRecord.date, true)}</span>
            </EntityCardMetaTile>
          )}
          {isColumnVisible("session") && (
            <EntityCardMetaTile label={t("attendance.columns.session")}>
              {attendanceRecord.sessionName || "—"}
            </EntityCardMetaTile>
          )}
          {isColumnVisible("status") && (
            <EntityCardMetaTile label={t("attendance.columns.status")}>
              <AttendanceRecordStatusCell
                attendanceRecord={attendanceRecord}
                editingRecord={editingRecord}
                statuses={statuses}
                updateDraft={updateDraft}
              />
            </EntityCardMetaTile>
          )}
          {isColumnVisible("timeIn") && (
            <EntityCardMetaTile label={t("attendance.columns.timeIn")}>
              {editingRecord?.id === attendanceRecord.id ? (
                <TimePicker
                  id={`attendance-mobile-time-in-${attendanceRecord.id}`}
                  name="timeIn"
                  value={editingRecord.timeIn}
                  onChange={(nextValue) => updateDraft("timeIn", nextValue)}
                  aria-label={t("attendance.columns.timeIn")}
                  className="w-full min-w-0 text-xs"
                />
              ) : (
                <span className="font-mono text-xs text-muted-foreground">
                  {attendanceRecord.timeIn || "—"}
                </span>
              )}
            </EntityCardMetaTile>
          )}
          {isColumnVisible("timeOut") && (
            <EntityCardMetaTile label={t("attendance.columns.timeOut")}>
              {editingRecord?.id === attendanceRecord.id ? (
                <TimePicker
                  id={`attendance-mobile-time-out-${attendanceRecord.id}`}
                  name="timeOut"
                  value={editingRecord.timeOut}
                  onChange={(nextValue) => updateDraft("timeOut", nextValue)}
                  aria-label={t("attendance.columns.timeOut")}
                  className="w-full min-w-0 text-xs"
                />
              ) : (
                <span className="font-mono text-xs text-muted-foreground">
                  {attendanceRecord.timeOut || "—"}
                </span>
              )}
            </EntityCardMetaTile>
          )}
          {isColumnVisible("notes") && (
            <EntityCardMetaTile label={t("attendance.columns.notes")}>
              <span className="break-words text-xs text-muted-foreground">
                {attendanceRecord.notes || "—"}
              </span>
            </EntityCardMetaTile>
          )}
        </EntityCard.MetaGrid>
      }
      actions={renderRowActions(attendanceRecord)}
    />
  );
}

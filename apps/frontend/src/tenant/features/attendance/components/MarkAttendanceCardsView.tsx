import React, { useRef } from "react";
import type { HTMLMotionProps } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import { EmptyState } from "@/components/app/EmptyState";
import { useTranslation } from "@/hooks/useTranslation";
import { getAttendanceStatusInfo, type AttendanceStatus } from "@/lib/data/attendanceData";
import type { ModuleFieldDef } from "@mms/shared";
import type { AttendanceRow } from "../lib/markAttendanceTypes";
import { MarkAttendanceStudentCard } from "./MarkAttendanceStudentCard";

export interface MarkAttendanceCardsViewProps {
  rows: AttendanceRow[];
  enabledFields: ModuleFieldDef[];
  statuses: AttendanceStatus[];
  onFieldChange: (studentId: string, key: string, value: unknown) => void;
  rowMotion: () => HTMLMotionProps<"div">;
}

export function MarkAttendanceCardsView({
  rows,
  enabledFields,
  statuses,
  onFieldChange,
  rowMotion,
}: MarkAttendanceCardsViewProps): React.JSX.Element {
  const { t } = useTranslation();
  const mobileParentRef = useRef<HTMLDivElement>(null);
  const isVirtualized = rows.length > 30;

  const mobileVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => mobileParentRef.current,
    estimateSize: () => 140,
    overscan: 3,
    enabled: isVirtualized,
  });

  return (
    <div
      ref={mobileParentRef}
      className={isVirtualized ? "space-y-3 p-3 max-h-160 overflow-y-auto" : "space-y-3 p-3"}
    >
      {rows.length === 0 ? (
        <EmptyState title={t("attendance.mark.noStudents")} compact />
      ) : isVirtualized ? (
        <div
          style={{
            height: `${mobileVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {mobileVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const statusInfo = getAttendanceStatusInfo(row.status, statuses);
            return (
              <div
                key={row.studentId}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="pb-3"
              >
                <MarkAttendanceStudentCard
                  row={row}
                  statusInfo={statusInfo}
                  enabledFields={enabledFields}
                  onFieldChange={onFieldChange}
                  motionProps={rowMotion()}
                />
              </div>
            );
          })}
        </div>
      ) : (
        rows.map((row) => {
          const statusInfo = getAttendanceStatusInfo(row.status, statuses);
          return (
            <MarkAttendanceStudentCard
              key={row.studentId}
              row={row}
              statusInfo={statusInfo}
              enabledFields={enabledFields}
              onFieldChange={onFieldChange}
              motionProps={rowMotion()}
            />
          );
        })
      )}
    </div>
  );
}

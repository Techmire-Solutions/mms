import React from "react";
import type { HTMLMotionProps } from "framer-motion";
import { EntityCardMetaTile } from "@/components/app/EntityCardMetaTile";
import { EntityCard } from "@/components/app/EntityCard";
import { useWorkCardAction } from "@/hooks/useWorkCardAction";
import type { getAttendanceStatusInfo } from "@/lib/data/attendanceData";
import { MarkAttendanceFieldControl } from "./MarkAttendanceFieldControl";
import { cn } from "@/lib/utils";
import type { ModuleFieldDef } from "@mms/shared";
import type { AttendanceRow } from "../lib/markAttendanceTypes";

/** EntityCard tile (workshop) — not DirectoryCard. */
export interface MarkAttendanceStudentCardProps {
  row: AttendanceRow;
  statusInfo: ReturnType<typeof getAttendanceStatusInfo>;
  enabledFields: ModuleFieldDef[];
  onFieldChange: (studentId: string, key: string, value: unknown) => void;
  motionProps?: HTMLMotionProps<"div">;
}

export function MarkAttendanceStudentCard({
  row,
  statusInfo,
  enabledFields,
  onFieldChange,
  motionProps,
}: MarkAttendanceStudentCardProps): React.JSX.Element {
  const { cardProps } = useWorkCardAction({
    entity: { id: row.studentId, name: row.name },
    selectedIds: [],
    canSelect: false,
  });

  return (
    <EntityCard className={cn("space-y-3 p-4", statusInfo?.bg)} {...cardProps} {...motionProps}>
      <EntityCard.Header
        id={row.studentId}
        displayName={row.name}
        subtitle={<span className="font-mono text-xs text-muted-foreground">{row.rollNo}</span>}
        isSelected={false}
        onSelect={() => {}}
        selectAriaLabel=""
        showSelect={false}
      />
      <EntityCard.MetaGrid className="grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/40 ms-0">
        {enabledFields.map((field) => (
          <EntityCardMetaTile
            key={field.id}
            label={`${field.label}${field.required ? " *" : ""}`}
            className={field.id === "notes" ? "sm:col-span-2" : ""}
          >
            <div className={field.id === "status" ? "flex justify-start mt-0.5" : "mt-0.5"}>
              <MarkAttendanceFieldControl
                row={row}
                field={field}
                idPrefix="mobile"
                onFieldChange={onFieldChange}
              />
            </div>
          </EntityCardMetaTile>
        ))}
      </EntityCard.MetaGrid>
    </EntityCard>
  );
}

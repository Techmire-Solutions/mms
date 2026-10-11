import type React from "react";
import { Check, MessageCircle, MessageSquare, X } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  MODULE_ROW_ACTIONS_TRIGGER_CLASS,
  ModuleRowActionsMenu,
} from "@/components/ui/ModuleRowActionsMenu";
import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@/components/ui/entityCardChrome";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { AttendanceRecord } from "@/lib/data/attendanceData";

export interface AttendanceRecordRowActionsProps {
  attendanceRecord: AttendanceRecord;
  editingRecord: AttendanceRecord | null;
  canWriteAttendance: boolean;
  canDeleteAttendance: boolean;
  showDeleted: boolean;
  variant?: "table" | "cards";
  onMessage?: (channel: "sms" | "whatsapp" | "email", records: AttendanceRecord[]) => void;
  onRestoreRecord: (id: string) => Promise<void>;
  setEditingRecord: React.Dispatch<React.SetStateAction<AttendanceRecord | null>>;
  setPendingDeleteId: React.Dispatch<React.SetStateAction<string | null>>;
  saveEditingRecord: () => Promise<void>;
  t: TranslationFunction;
}

/** Attendance record row-actions menu — ModuleRowActionsMenu adapter with inline-edit + messaging extras. */
export function AttendanceRecordRowActions({
  attendanceRecord,
  editingRecord,
  canWriteAttendance,
  canDeleteAttendance,
  showDeleted,
  variant = "table",
  onMessage,
  onRestoreRecord,
  setEditingRecord,
  setPendingDeleteId,
  saveEditingRecord,
  t,
}: AttendanceRecordRowActionsProps): React.JSX.Element {
  const isEditing = editingRecord?.id === attendanceRecord.id;
  const triggerClassName =
    variant === "cards" ? ENTITY_CARD_OVERFLOW_TRIGGER_CLASS : MODULE_ROW_ACTIONS_TRIGGER_CLASS;

  return (
    <ModuleRowActionsMenu
      triggerLabel={t("attendance.table.actions")}
      editLabel={t("common.edit")}
      deleteLabel={t("attendance.deleteRecord")}
      restoreLabel={t("attendance.restoreRecord")}
      archived={showDeleted}
      canWrite={canWriteAttendance}
      canDelete={canDeleteAttendance}
      hideViewItem
      onEdit={isEditing ? undefined : () => setEditingRecord(attendanceRecord)}
      onDelete={() => setPendingDeleteId(attendanceRecord.id)}
      onRestore={showDeleted ? () => void onRestoreRecord(attendanceRecord.id) : undefined}
      triggerClassName={triggerClassName}
      extras={
        <>
          {isEditing ? (
            <>
              <DropdownMenuItem onClick={() => void saveEditingRecord()}>
                <Check className="w-3.5 h-3.5 me-2 text-success" /> {t("common.save")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditingRecord(null)}>
                <X className="w-3.5 h-3.5 me-2" /> {t("common.cancel")}
              </DropdownMenuItem>
            </>
          ) : onMessage && !showDeleted ? (
            <>
              <DropdownMenuItem onClick={() => onMessage("whatsapp", [attendanceRecord])}>
                <MessageCircle className="w-3.5 h-3.5 me-2 text-success" />{" "}
                {t("attendance.message.whatsapp")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMessage("sms", [attendanceRecord])}>
                <MessageSquare className="w-3.5 h-3.5 me-2 text-info" />{" "}
                {t("attendance.message.sms")}
              </DropdownMenuItem>
            </>
          ) : undefined}
        </>
      }
    />
  );
}

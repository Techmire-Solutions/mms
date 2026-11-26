import React from "react";
import { attendanceTransferSchema, type AttendanceTransferEntity } from "@mms/contracts";
import { StandardModuleCsvImportDialog } from "@mms/fe-core/components/StandardModuleCsvImportDialog";

export interface AttendanceCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Attendance using SSOT schema. */
export function AttendanceCsvImportDialog({
  open,
  onClose,
  canWrite,
}: AttendanceCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<AttendanceTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/attendance/import"
      schema={attendanceTransferSchema}
      navKey="nav.attendance"
    />
  );
}

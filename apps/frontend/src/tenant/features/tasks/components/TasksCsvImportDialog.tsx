import React from "react";
import {
  tasksTransferSchema,
  type TaskTransferEntity,
} from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/ui/StandardModuleCsvImportDialog";

export interface TasksCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Tasks using SSOT schema. */
export function TasksCsvImportDialog({
  open,
  onClose,
  canWrite,
}: TasksCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<TaskTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath="/api/tasks/import"
      schema={tasksTransferSchema}
      navKey="nav.tasks"
    />
  );
}

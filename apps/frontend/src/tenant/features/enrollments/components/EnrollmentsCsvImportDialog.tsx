import React from "react";
import {
  ENROLLMENTS_MODULE_MANIFEST,
  enrollmentsTransferSchema,
  type EnrollmentTransferEntity,
} from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/app/StandardModuleCsvImportDialog";

export interface EnrollmentsCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Enrollments using SSOT schema. */
export function EnrollmentsCsvImportDialog({
  open,
  onClose,
  canWrite,
}: EnrollmentsCsvImportDialogProps): React.JSX.Element | null {
  return (
    <StandardModuleCsvImportDialog<EnrollmentTransferEntity>
      open={open}
      onClose={onClose}
      canWrite={canWrite}
      apiPath={`${ENROLLMENTS_MODULE_MANIFEST.restBasePath}/import`}
      preflightPath={`${ENROLLMENTS_MODULE_MANIFEST.restBasePath}/import/preflight`}
      schema={enrollmentsTransferSchema}
      navKey="nav.enrollments"
    />
  );
}

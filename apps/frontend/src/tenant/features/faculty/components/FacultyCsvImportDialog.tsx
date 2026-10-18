import React from "react";
import {
  facultyTransferSchema,
  facultyDesignationTransferSchema,
  type FacultyTransferEntity,
  type FacultyDesignationCsvRow,
} from "@mms/shared";
import { ModuleImportDialog } from "@/components/app/ModuleImportDialog";
import { useModuleCsvImportActions } from "@/lib/backgroundJobs/useModuleCsvImportActions";
import { useTranslation } from "@/hooks/useTranslation";
import type { FacultyIoEntity } from "@/tenant/features/faculty/facultyPageWorkSubTabs";

export interface FacultyCsvImportDialogProps {
  open: boolean;
  entity: FacultyIoEntity | null;
  onClose: () => void;
  canWrite: boolean;
}

/** Standardized CSV import dialog for Faculties and Designations using SSOT schema. */
export function FacultyCsvImportDialog({
  open,
  entity,
  onClose,
  canWrite,
}: FacultyCsvImportDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();

  const facultyActions = useModuleCsvImportActions<FacultyTransferEntity>({
    apiPath: "/api/faculty/import",
    schema: facultyTransferSchema,
    defaultLabel: t("faculty.io.importFacultiesJob"),
    onSuccess: onClose,
  });

  const designationActions = useModuleCsvImportActions<FacultyDesignationCsvRow>({
    apiPath: "/api/faculty/designations/import",
    schema: facultyDesignationTransferSchema,
    defaultLabel: t("faculty.io.importDesignationsJob"),
    onSuccess: onClose,
  });

  if (!open || !entity || !canWrite) return null;

  if (entity === "faculties") {
    return (
      <ModuleImportDialog<FacultyTransferEntity>
        open={open}
        onClose={onClose}
        title={t("faculty.io.importFaculties")}
        subtitle={t("faculty.io.csvHint")}
        canWrite={canWrite}
        actions={facultyActions}
      />
    );
  }

  return (
    <ModuleImportDialog<FacultyDesignationCsvRow>
      open={open}
      onClose={onClose}
      title={t("faculty.io.importDesignations")}
      subtitle={t("faculty.io.csvHint")}
      canWrite={canWrite}
      actions={designationActions}
    />
  );
}

import React from "react";
import type { AppTranslationKey, ModuleTransferSchema } from "@mms/shared";
import { ModuleImportDialog } from "@/components/app/ModuleImportDialog";
import { useModuleCsvImportActions } from "@/lib/backgroundJobs/useModuleCsvImportActions";
import type { ModuleCsvImportSubmitRows } from "@/lib/backgroundJobs/useModuleCsvImportActions";
import { useTranslation } from "@/hooks/useTranslation";

export interface StandardModuleCsvImportDialogProps<TRow = Record<string, unknown>> {
  open: boolean;
  onClose: () => void;
  canWrite: boolean;
  apiPath: string;
  schema?: ModuleTransferSchema<TRow>;
  navKey?: AppTranslationKey;
  title?: string;
  subtitle?: string;
  submitRows?: ModuleCsvImportSubmitRows<TRow>;
  preflightPath?: string;
  /** Called after the queued import job completes (invalidate module caches). */
  onSuccess?: () => void;
}

/**
 * Standardized module CSV import dialog SSOT.
 * Connects standard background CSV import actions to ModuleImportDialog.
 */
export function StandardModuleCsvImportDialog<TRow = Record<string, unknown>>({
  open,
  onClose,
  canWrite,
  apiPath,
  schema,
  navKey,
  title,
  subtitle,
  submitRows,
  preflightPath,
  onSuccess,
}: StandardModuleCsvImportDialogProps<TRow>): React.JSX.Element | null {
  const { t } = useTranslation();

  const actions = useModuleCsvImportActions<TRow>({
    apiPath,
    schema,
    submitRows,
    preflightPath,
    onSuccess,
    // Deliberately no `onSuccess: onClose`: closing on submit success unmounted the
    // dialog before `ModuleImportDialog` could render `completedJob`, so imported /
    // failed counts were never shown (2026-11-04 review, S-01). The dialog now stays
    // open and the user closes it (or starts another import).
  });

  if (!open || !canWrite) return null;

  const resolvedTitle =
    title ?? (navKey ? `${t("common.import")} - ${t(navKey)}` : t("common.import"));
  const resolvedSubtitle = subtitle ?? t("faculty.io.csvHint");

  return (
    <ModuleImportDialog<TRow>
      open={open}
      onClose={onClose}
      title={resolvedTitle}
      subtitle={resolvedSubtitle}
      canWrite={canWrite}
      actions={actions}
    />
  );
}

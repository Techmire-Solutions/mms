import React from "react";
import type { AppTranslationKey, ModuleTransferSchema } from "@mms/shared";
import { ModuleImportDialog } from "@/components/ui/ModuleImportDialog";
import { useModuleCsvImportActions } from "@/lib/backgroundJobs/useModuleCsvImportActions";
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
}: StandardModuleCsvImportDialogProps<TRow>): React.JSX.Element | null {
  const { t } = useTranslation();

  const actions = useModuleCsvImportActions<TRow>({
    apiPath,
    schema,
    onSuccess: onClose,
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

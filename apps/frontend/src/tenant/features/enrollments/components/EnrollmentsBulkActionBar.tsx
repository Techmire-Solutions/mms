import type { ReactElement } from "react";
import { ClipboardList, XCircle } from "lucide-react";
import { ENROLLMENTS_MODULE_MANIFEST } from "@mms/shared";
import { bulkActionDockActionClassName } from "@/components/app/bulkActionDockStyles";
import { Button } from "@/components/ui/button";
import { ModuleUniversalBulkActionBar } from "@/components/app/ModuleUniversalBulkActionBar";
import { useTranslation } from "@/hooks/useTranslation";

export interface EnrollmentsBulkActionBarProps {
  selectedCount: number;
  showDeleted: boolean;
  canDelete: boolean;
  canCancel: boolean;
  canExport?: boolean;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onRequestBulkCancel: () => void;
  onClearSelection: () => void;
  onBulkExport?: () => void;
  bulkActions?: readonly string[];
}

/** Enrollments Work bulk bar — delegates to shared ModuleUniversalBulkActionBar. */
export function EnrollmentsBulkActionBar({
  selectedCount,
  showDeleted,
  canDelete,
  canCancel,
  canExport = false,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onRequestBulkCancel,
  onClearSelection,
  onBulkExport,
  bulkActions = ENROLLMENTS_MODULE_MANIFEST.work.bulkActions,
}: EnrollmentsBulkActionBarProps): ReactElement {
  const { t } = useTranslation();

  return (
    <ModuleUniversalBulkActionBar
      selectedCount={selectedCount}
      viewingDeleted={showDeleted}
      canDelete={canDelete}
      canExport={canExport}
      leadingIcon={ClipboardList}
      i18nNamespace="enrollments"
      bulkActions={bulkActions}
      onClearSelection={onClearSelection}
      onRequestBulkDelete={onRequestBulkDelete}
      onRequestBulkRestore={onRequestBulkRestore}
      onBulkExport={onBulkExport}
      deleteLabel={t("enrollments.archive")}
      extraActions={
        bulkActions.includes("cancel") && canCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onRequestBulkCancel}
            className={bulkActionDockActionClassName}
          >
            <XCircle className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />{" "}
            {t("enrollments.bulkCancel")}
          </Button>
        ) : undefined
      }
    />
  );
}

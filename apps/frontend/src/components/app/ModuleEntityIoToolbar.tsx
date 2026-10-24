import type { LucideIcon } from "lucide-react";
import { Download, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface ModuleEntityIoToolbarProps {
  canExport?: boolean;
  canWrite?: boolean;
  viewingDeleted?: boolean;
  onExport?: () => void;
  onImport?: () => void;
  onAdd?: () => void;
  addLabel: string;
  addIcon?: LucideIcon;
  exportLabel?: string;
  importLabel?: string;
}

/**
 * Shared operational-tab IO row: Export / Import / Add.
 * Mount above Work directory chrome; omit on Reports/Setup; hide in trash.
 */
export function ModuleEntityIoToolbar({
  canExport = false,
  canWrite = false,
  viewingDeleted = false,
  onExport,
  onImport,
  onAdd,
  addLabel,
  addIcon: AddIcon = Plus,
  exportLabel,
  importLabel,
}: ModuleEntityIoToolbarProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (viewingDeleted) return null;

  const showExport = Boolean(canExport && onExport);
  const showImport = Boolean(canWrite && onImport);
  const showAdd = Boolean(canWrite && onAdd);
  if (!showExport && !showImport && !showAdd) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {showExport ? (
        <Button variant="ghost" icon={Download} onClick={onExport}>
          {exportLabel ?? t("common.export")}
        </Button>
      ) : null}
      {showImport ? (
        <Button variant="ghost" icon={Upload} onClick={onImport}>
          {importLabel ?? t("common.import")}
        </Button>
      ) : null}
      {showAdd ? (
        <Button variant="primary" icon={AddIcon} onClick={onAdd}>
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}

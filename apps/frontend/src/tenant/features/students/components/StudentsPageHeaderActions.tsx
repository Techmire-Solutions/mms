import { UserPlus, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface StudentsPageHeaderActionsProps {
  canExport: boolean;
  canWrite: boolean;
  viewingDeleted: boolean;
  onExport: () => void;
  onAddStudent: () => void;
  onImport?: () => void;
}

export function StudentsPageHeaderActions({
  canExport,
  canWrite,
  viewingDeleted,
  onExport,
  onAddStudent,
  onImport,
}: StudentsPageHeaderActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      {canExport && !viewingDeleted ? (
        <Button variant="ghost" icon={Download} onClick={onExport}>
          {t("common.export")}
        </Button>
      ) : null}
      {canWrite && !viewingDeleted && onImport ? (
        <Button variant="outline" icon={Upload} onClick={onImport}>
          {t("common.import")}
        </Button>
      ) : null}
      {canWrite && !viewingDeleted ? (
        <Button variant="primary" icon={UserPlus} onClick={onAddStudent}>
          {t("action.addStudent")}
        </Button>
      ) : null}
    </>
  );
}

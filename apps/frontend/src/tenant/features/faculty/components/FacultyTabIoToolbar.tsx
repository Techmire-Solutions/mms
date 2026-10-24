import { Award, UserPlus } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleEntityIoToolbar } from "@/components/app/ModuleEntityIoToolbar";
import type { FacultyIoEntity } from "@/tenant/features/faculty/facultyPageWorkSubTabs";

export type { FacultyIoEntity };

export interface FacultyTabIoToolbarProps {
  entity: FacultyIoEntity;
  canExport: boolean;
  canWrite: boolean;
  viewingDeleted: boolean;
  onExportEntity: (entity: FacultyIoEntity) => void;
  onImportEntity: (entity: FacultyIoEntity) => void;
  onAdd: () => void;
}

/** Scoped Import / Export / Add for one Faculty entity tab. */
export function FacultyTabIoToolbar({
  entity,
  canExport,
  canWrite,
  viewingDeleted,
  onExportEntity,
  onImportEntity,
  onAdd,
}: FacultyTabIoToolbarProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const addLabel =
    entity === "faculties" ? t("action.addFaculty") : t("faculty.designations.addDesignation");
  const AddIcon = entity === "faculties" ? UserPlus : Award;

  return (
    <ModuleEntityIoToolbar
      canExport={canExport}
      canWrite={canWrite}
      viewingDeleted={viewingDeleted}
      onExport={() => onExportEntity(entity)}
      onImport={() => onImportEntity(entity)}
      onAdd={onAdd}
      addLabel={addLabel}
      addIcon={AddIcon}
      exportLabel={t("faculty.io.export")}
      importLabel={t("faculty.io.import")}
    />
  );
}

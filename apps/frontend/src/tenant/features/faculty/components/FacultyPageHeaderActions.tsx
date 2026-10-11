import {
  Award,
  Download,
  Upload,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/useTranslation";
import {
  FACULTY_IO_ENTITY_IDS,
  type FacultyIoEntity,
} from "@/tenant/features/faculty/facultyPageWorkSubTabs";

export type { FacultyIoEntity };

export interface FacultyPageHeaderActionsProps {
  canExport: boolean;
  canWrite: boolean;
  viewingDeleted: boolean;
  onExportEntity: (entity: FacultyIoEntity) => void;
  onImportEntity: (entity: FacultyIoEntity) => void;
  onAddFaculty?: () => void;
  onAddDesignation?: () => void;
}

/**
 * Module-dashboard IO: Import/Export choosers + Add Faculty / Add Designation.
 * Matching scoped Add also lives on {@link FacultyTabIoToolbar}.
 */
export function FacultyPageHeaderActions({
  canExport,
  canWrite,
  viewingDeleted,
  onExportEntity,
  onImportEntity,
  onAddFaculty,
  onAddDesignation,
}: FacultyPageHeaderActionsProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (viewingDeleted) return null;

  const entityLabel = (entity: FacultyIoEntity) => {
    if (entity === "faculties") return t("faculty.tabs.faculties");
    return t("faculty.tabs.designations");
  };

  return (
    <>
      {canExport ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" icon={Download}>
              {t("faculty.io.export")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {FACULTY_IO_ENTITY_IDS.map((entity) => (
              <DropdownMenuItem
                key={`export-${entity}`}
                className="cursor-pointer"
                onClick={() => onExportEntity(entity)}
              >
                {entityLabel(entity)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {canWrite ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" icon={Upload}>
              {t("faculty.io.import")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {FACULTY_IO_ENTITY_IDS.map((entity) => (
              <DropdownMenuItem
                key={`import-${entity}`}
                className="cursor-pointer"
                onClick={() => onImportEntity(entity)}
              >
                {entityLabel(entity)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {canWrite && onAddDesignation ? (
        <Button variant="ghost" icon={Award} onClick={onAddDesignation}>
          {t("faculty.designations.addDesignation")}
        </Button>
      ) : null}

      {canWrite && onAddFaculty ? (
        <Button variant="primary" icon={UserPlus} onClick={onAddFaculty}>
          {t("action.addFaculty")}
        </Button>
      ) : null}
    </>
  );
}

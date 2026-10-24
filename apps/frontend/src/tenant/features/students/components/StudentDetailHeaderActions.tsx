import React from "react";
import { IdCard } from "lucide-react";
import type { Student } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { DetailDrawerRestoreOrEditAction } from "@/components/app/DetailDrawerArchiveChrome";

export interface StudentDetailHeaderActionsProps {
  student: Student;
  isArchived: boolean;
  canDelete: boolean;
  canEdit: boolean;
  onPrintIdCard?: (student: Student) => void;
  onRestore?: () => void;
  onEdit?: () => void;
  printLabel: string;
  restoreLabel: string;
  editLabel: string;
}

/** Action buttons rendered in the header slot of the StudentDetail drawer. */
export function StudentDetailHeaderActions({
  student,
  isArchived,
  canDelete,
  canEdit,
  onPrintIdCard,
  onRestore,
  onEdit: onEditAction,
  printLabel,
  restoreLabel,
  editLabel,
}: StudentDetailHeaderActionsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      {!isArchived && onPrintIdCard ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPrintIdCard(student)}
          className="min-h-11 px-3 gap-1.5 font-medium text-xs border-border/60 hover:bg-muted/80"
          title={printLabel}
          aria-label={printLabel}
        >
          <IdCard className="w-3.5 h-3.5" aria-hidden />
          <span className="hidden sm:inline">{printLabel}</span>
        </Button>
      ) : null}
      <DetailDrawerRestoreOrEditAction
        isArchived={isArchived}
        canRestore={canDelete}
        canEdit={canEdit}
        restoreLabel={restoreLabel}
        editLabel={editLabel}
        onRestore={onRestore}
        onEdit={onEditAction}
      />
    </div>
  );
}

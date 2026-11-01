import React, { type ReactNode } from "react";
import { Edit2, Eye, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Row-action trigger styling shared by Work table/card row action menus.
 *
 * Always visible: hover-only reveal made the Actions column look empty at rest
 * (and on touch there is no hover), so the primary record affordance was
 * undiscoverable. The 44px target and muted border keep it quiet.
 */
export const MODULE_ROW_ACTIONS_TRIGGER_CLASS =
  "min-w-11 min-h-11 rounded-lg border border-border/50 bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-100 shadow-none";

export interface ModuleRowActionsMenuProps {
  /** Trigger aria-label (translated by the module). */
  triggerLabel: string;
  /** Common item labels (translated by the module). */
  viewLabel?: string;
  editLabel?: string;
  deleteLabel?: string;
  restoreLabel?: string;
  /** True when the row is soft-deleted (archive view → restore item only). */
  archived: boolean;
  canWrite: boolean;
  canDelete: boolean;
  onView?: () => void;
  onEdit?: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  /** When true, omit View (face header/footer or card already opens the profile). */
  hideViewItem?: boolean;
  /** Module-specific items rendered between edit and delete/restore (messaging etc.). */
  extras?: ReactNode;
  triggerClassName?: string;
  contentClassName?: string;
  iconClassName?: string;
}

/**
 * Shared row-actions dropdown (Work table/card rows).
 *
 * Renders the ghost icon trigger, menu chrome, and the common view / edit /
 * delete / restore items; modules inject their own extras (messaging channels)
 * and translated labels, so Contacts and Students no longer fork the menu shell.
 */
export const ModuleRowActionsMenu = function ModuleRowActionsMenu({
  triggerLabel,
  viewLabel,
  editLabel,
  deleteLabel,
  restoreLabel,
  archived,
  canWrite,
  canDelete,
  onView,
  onEdit,
  onDelete,
  onRestore,
  hideViewItem = false,
  extras,
  triggerClassName,
  contentClassName,
  iconClassName = "w-4 h-4",
}: ModuleRowActionsMenuProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          type="button"
          aria-label={triggerLabel}
          className={
            triggerClassName ??
            "min-w-11 min-h-11 p-0 flex items-center justify-center rounded-lg border border-border/50 bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shadow-none"
          }
        >
          <MoreHorizontal className={iconClassName} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={contentClassName ?? "w-44"}>
        {onView && !hideViewItem && viewLabel ? (
          <DropdownMenuItem onClick={onView}>
            <Eye className="w-3.5 h-3.5 me-2" /> {viewLabel}
          </DropdownMenuItem>
        ) : null}
        {!archived ? (
          <>
            {canWrite && onEdit && editLabel ? (
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="w-3.5 h-3.5 me-2" /> {editLabel}
              </DropdownMenuItem>
            ) : null}
            {extras}
            {canDelete && deleteLabel ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5 me-2" /> {deleteLabel}
                </DropdownMenuItem>
              </>
            ) : null}
          </>
        ) : null}
        {archived && canDelete && onRestore && restoreLabel ? (
          <DropdownMenuItem onClick={onRestore}>
            <RotateCcw className="w-3.5 h-3.5 me-2" /> {restoreLabel}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

import React from "react";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WORK_TOOLBAR_TRIGGER,
  WORK_TOOLBAR_TRIGGER_ACTIVE,
  WORK_TOOLBAR_TRIGGER_IDLE,
} from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

export interface ModuleTrashToggleProps {
  /** True while the directory is showing soft-deleted records. */
  viewingDeleted: boolean;
  onToggle: () => void;
  /** Label shown while viewing deleted records (returns to the active view). */
  activeLabel: string;
  /** Label shown while viewing active records (enters the trash view). */
  deletedLabel: string;
  className?: string;
  disabled?: boolean;
  title?: string;
}

/**
 * Work-tier trash/archive toggle used across soft-delete modules.
 * Labels are mandatory and translated by the module (no English fallbacks).
 */
export const ModuleTrashToggle = function ModuleTrashToggle({
  viewingDeleted,
  onToggle,
  activeLabel,
  deletedLabel,
  className,
  disabled = false,
  title,
}: ModuleTrashToggleProps): React.JSX.Element {
  const label = viewingDeleted ? activeLabel : deletedLabel;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onToggle}
      disabled={disabled}
      title={title ?? label}
      aria-pressed={viewingDeleted}
      aria-label={label}
      className={cn(
        WORK_TOOLBAR_TRIGGER,
        viewingDeleted ? WORK_TOOLBAR_TRIGGER_ACTIVE : WORK_TOOLBAR_TRIGGER_IDLE,
        className,
      )}
    >
      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Button>
  );
};

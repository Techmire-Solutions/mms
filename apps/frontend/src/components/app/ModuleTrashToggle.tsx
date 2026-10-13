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
  showDeleted?: boolean;
  viewingDeleted?: boolean;
  onToggle: () => void;
  showActiveLabel?: string;
  showDeletedLabel?: string;
  activeLabel?: string;
  deletedLabel?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
}

/**
 * Work-tier trash/archive toggle used across soft-delete modules.
 */
export const ModuleTrashToggle = function ModuleTrashToggle({
  showDeleted,
  viewingDeleted,
  onToggle,
  showActiveLabel,
  showDeletedLabel,
  activeLabel,
  deletedLabel,
  className,
  disabled = false,
  title,
}: ModuleTrashToggleProps): React.JSX.Element {
  const isDeleted = viewingDeleted ?? showDeleted ?? false;
  const label = isDeleted
    ? (showActiveLabel ?? activeLabel ?? "Show Active")
    : (showDeletedLabel ?? deletedLabel ?? "Show Trash");

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onToggle}
      disabled={disabled}
      title={title ?? label}
      aria-pressed={isDeleted}
      aria-label={label}
      className={cn(
        WORK_TOOLBAR_TRIGGER,
        isDeleted ? WORK_TOOLBAR_TRIGGER_ACTIVE : WORK_TOOLBAR_TRIGGER_IDLE,
        className,
      )}
    >
      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Button>
  );
};

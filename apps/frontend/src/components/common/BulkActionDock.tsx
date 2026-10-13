import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BulkSelectionClearAction,
  BulkSelectionDeleteAction,
  BulkSelectionRestoreAction,
  BulkSelectionExportAction,
  BulkSelectionMessagingActions,
  BulkSelectionStatusAction,
  type BulkSelectionMessageChannel,
} from "@/components/app/BulkSelectionActions";

export type BulkActionDockPlacement = "floating" | "inline";
export type BulkActionDockTone = "glass" | "tint" | "plain";

export {
  BulkSelectionClearAction,
  BulkSelectionDeleteAction,
  BulkSelectionRestoreAction,
  BulkSelectionExportAction,
  BulkSelectionMessagingActions,
  BulkSelectionStatusAction,
  type BulkSelectionMessageChannel,
};

const PLACEMENT: Record<BulkActionDockPlacement, string> = {
  floating:
    "fixed inset-x-4 bottom-4 z-header max-w-full sm:inset-x-auto sm:end-6 sm:bottom-6 surface-overlay rounded-2xl p-3 flex flex-wrap items-center gap-3 border-s-4 border-s-primary shadow-surface-lg",
  inline: "flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl max-w-full",
};

const INLINE_TONE: Record<BulkActionDockTone, string> = {
  glass: "surface-raised border-primary/20",
  tint: "border border-primary/20 bg-primary/5 gap-2 py-2.5",
  plain: "border border-border bg-card",
};

export interface BulkActionDockActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "outline" | "destructive" | "ghost" | "default";
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

function DockAction({
  variant = "outline",
  icon: Icon,
  className,
  children,
  ...props
}: BulkActionDockActionProps): React.JSX.Element {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={cn("min-h-11 px-3 text-xs font-semibold gap-1.5", className)}
      {...props}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      {children}
    </Button>
  );
}

function DockSeparator({ className }: { className?: string }): React.JSX.Element {
  return <div className={cn("h-4 w-px bg-border shrink-0", className)} aria-hidden />;
}

export interface BulkActionDockProps {
  selectedCount: number;
  totalCount?: number;
  onClearSelection?: () => void;
  countLabel?: React.ReactNode;
  clearLabel?: string;
  isAllSelected?: boolean;
  onSelectAllToggle?: () => void;
  placement?: BulkActionDockPlacement;
  tone?: BulkActionDockTone;
  leading?: React.ReactNode;
  children?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
  enableEscapeKey?: boolean;
}

/**
 * Universal BulkActionDock primitive.
 * Floating selection dock with Escape key integration and generic selection models.
 */
export function BulkActionDock({
  selectedCount,
  totalCount,
  onClearSelection = () => {},
  countLabel,
  clearLabel,
  isAllSelected,
  onSelectAllToggle,
  placement = "floating",
  tone = "glass",
  leading,
  children,
  trailing,
  className,
  "aria-label": ariaLabel = "Bulk actions toolbar",
  enableEscapeKey = true,
}: BulkActionDockProps): React.JSX.Element {
  useEffect(() => {
    if (!enableEscapeKey || selectedCount === 0) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClearSelection();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableEscapeKey, selectedCount, onClearSelection]);

  const enterY = placement === "floating" ? 20 : -8;
  const resolvedCountLabel =
    countLabel ??
    (totalCount !== undefined
      ? `${selectedCount} / ${totalCount} selected`
      : `${selectedCount} selected`);

  const resolvedTrailing =
    trailing ??
    (clearLabel ? (
      <BulkSelectionClearAction label={clearLabel} onClick={onClearSelection} />
    ) : undefined);

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          role="region"
          aria-label={ariaLabel}
          initial={{ opacity: 0, y: enterY }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: enterY }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={cn(
            placement === "floating" ? PLACEMENT.floating : cn(PLACEMENT.inline, INLINE_TONE[tone]),
            className,
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {leading}
            <span
              className={cn(
                "text-foreground",
                placement === "floating" ? "text-xs font-bold ps-1" : "text-sm font-semibold",
              )}
            >
              {resolvedCountLabel}
            </span>
            {onSelectAllToggle && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSelectAllToggle}
                className="text-xs h-7 px-2 min-h-7 text-primary hover:text-primary"
              >
                {isAllSelected ? "Deselect all" : "Select all"}
              </Button>
            )}
            {placement === "floating" && (children || resolvedTrailing) && <DockSeparator />}
          </div>

          {(children || resolvedTrailing) && (
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              {children}
              {resolvedTrailing}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

BulkActionDock.Action = DockAction;
BulkActionDock.Separator = DockSeparator;
BulkActionDock.Clear = BulkSelectionClearAction;
BulkActionDock.Delete = BulkSelectionDeleteAction;
BulkActionDock.Restore = BulkSelectionRestoreAction;
BulkActionDock.Export = BulkSelectionExportAction;
BulkActionDock.Messaging = BulkSelectionMessagingActions;
BulkActionDock.Status = BulkSelectionStatusAction;

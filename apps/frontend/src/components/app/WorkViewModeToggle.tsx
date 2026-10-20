import React from "react";
import { LayoutGrid, Table } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { cn } from "@/lib/utils";

export interface WorkViewModeToggleProps {
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  className?: string;
  disabled?: boolean;
}

const VIEW_MODE_OPTIONS: ReadonlyArray<{
  mode: WorkDirectoryViewMode;
  labelKey: "common.viewMode.table" | "common.viewMode.cards";
  icon: typeof Table;
}> = [
  { mode: "table", labelKey: "common.viewMode.table", icon: Table },
  { mode: "cards", labelKey: "common.viewMode.cards", icon: LayoutGrid },
];

export const WorkViewModeToggle = function WorkViewModeToggle({
  viewMode,
  onViewModeChange,
  className,
  disabled = false,
}: WorkViewModeToggleProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "inline-flex items-center h-11 p-1 rounded-xl border border-border/80 bg-card shadow-xs",
        className,
      )}
      role="group"
      aria-label={t("common.viewMode.group")}
    >
      {VIEW_MODE_OPTIONS.map(({ mode, labelKey, icon: Icon }) => {
        const isSelected = viewMode === mode;
        const label = t(labelKey);

        return (
          <Button
            key={mode}
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => onViewModeChange(mode)}
            title={label}
            aria-label={label}
            aria-pressed={isSelected}
            className={cn(
              "relative h-9 px-2.5 rounded-lg text-xs font-semibold transition-colors touch-manipulation z-elevated cursor-pointer",
              isSelected
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            {isSelected && (
              <motion.div
                layoutId="workViewModeActivePill"
                className="absolute inset-0 rounded-lg bg-primary shadow-xs -z-elevated"
                transition={
                  reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 35 }
                }
              />
            )}
            <Icon className="w-4 h-4" aria-hidden="true" />
          </Button>
        );
      })}
    </div>
  );
};

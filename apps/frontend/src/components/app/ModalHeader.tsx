import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export interface ModalHeaderProps {
  titleId: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  headerActions?: React.ReactNode;
  headerExtra?: React.ReactNode;
  progress?: number;
  progressLabel?: React.ReactNode;
  onClose: () => void;
  dismissible?: boolean;
  className?: string;
}

export function ModalHeader({
  titleId,
  title,
  subtitle,
  icon: Icon,
  headerActions,
  headerExtra,
  progress,
  progressLabel,
  onClose,
  dismissible = true,
  className,
}: ModalHeaderProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-4 sm:p-6 border-b border-border/40 flex-shrink-0",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-base sm:text-lg font-bold text-foreground leading-tight text-balance break-words"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 text-balance break-words">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ms-auto">
          {headerActions}
          {dismissible && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 h-11 w-11 min-h-11 min-w-11 flex items-center justify-center touch-manipulation"
              aria-label={t("common.close")}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {progress !== undefined && (
        <div className="w-full space-y-1 pt-1">
          {progressLabel && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progressLabel}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          )}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}

      {headerExtra}
    </div>
  );
}

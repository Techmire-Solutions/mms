import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface DetailDrawerHeaderProps {
  titleId: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  headerActions?: React.ReactNode;
  headerExtra?: React.ReactNode;
  onClose: () => void;
  isDesktop: boolean;
  onPointerDragStart: (e: React.PointerEvent) => void;
}

export function DetailDrawerHeader({
  titleId,
  title,
  subtitle,
  badge,
  icon: Icon,
  headerActions,
  headerExtra,
  onClose,
  isDesktop,
  onPointerDragStart,
}: DetailDrawerHeaderProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="sticky top-0 z-elevated px-5 pt-2 sm:pt-4 pb-3 border-b border-border/30 flex-shrink-0 space-y-3">
      <div
        className="flex items-center justify-between gap-4 touch-none sm:touch-auto select-none"
        onPointerDown={(e) => {
          const target = e.target as HTMLElement | null;
          const isInteractive = target?.closest(
            'button, input, select, textarea, a, [role="tab"], [data-no-drag]',
          );
          if (!isDesktop && !isInteractive) {
            onPointerDragStart(e);
          }
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 id={titleId} className="text-sm font-bold text-foreground leading-tight truncate">
                {title}
              </h2>
              {badge}
            </div>
            {subtitle && (
              <span className="text-3xs text-muted-foreground uppercase tracking-wider font-bold block truncate mt-0.5">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0" data-no-drag>
          {headerActions}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            className="rounded-lg border border-border/50 bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shadow-none"
            aria-label={t("common.close")}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {headerExtra && (
        <div className="touch-pan-x" data-no-drag>
          {headerExtra}
        </div>
      )}
    </div>
  );
}

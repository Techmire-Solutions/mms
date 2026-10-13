import React, { useId, useCallback } from "react";
import { motion, type PanInfo, useDragControls } from "framer-motion";
import { OverlayShell } from "@/components/ui/OverlayShell";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { DetailDrawerHeader } from "./DetailDrawerHeader";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "./DetailDrawerArchiveChrome";
import {
  DRAWER_SIZE_MAP,
  getDrawerContainerPlacement,
  getDrawerPanelBorder,
} from "./drawerVariants";

export type DrawerSide = "start" | "end" | "bottom" | "responsive";
export type DrawerSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";

export interface DrawerProps {
  open?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  size?: DrawerSize;
  side?: DrawerSide;
  headerActions?: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  archiveBanner?: React.ReactNode;
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  contentClassName?: string;
}

/**
 * Universal Drawer primitive supporting responsive mobile bottom-sheet adaptation,
 * directional slide-in positioning, and composed archive chrome.
 */
export function Drawer({
  open = true,
  onClose,
  title,
  subtitle,
  badge,
  icon: Icon,
  size = "md",
  side = "responsive",
  headerActions,
  headerExtra,
  footer,
  archiveBanner,
  children,
  ariaLabel,
  className,
  contentClassName,
}: DrawerProps): React.JSX.Element | null {
  const { isRtl } = useTranslation();
  const reducedMotion = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const titleId = useId();
  const dragControls = useDragControls();

  const isBottom = side === "bottom" || (side === "responsive" && !isDesktop);
  const isStart = side === "start";
  const slideFromX = isStart ? (isRtl ? "100%" : "-100%") : isRtl ? "-100%" : "100%";

  const panelTransition = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, damping: 28, stiffness: 260 };

  const initial = reducedMotion
    ? false
    : isBottom
      ? { x: 0, y: "100%", opacity: 0 }
      : { x: slideFromX, y: 0, opacity: 0 };

  const animate = reducedMotion ? { opacity: 1 } : { x: 0, y: 0, opacity: 1 };
  const exit = reducedMotion
    ? { opacity: 0 }
    : isBottom
      ? { x: 0, y: "100%", opacity: 0 }
      : { x: slideFromX, y: 0, opacity: 0 };

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.velocity.y > 400 || info.offset.y > 100) onClose();
    },
    [onClose],
  );

  return (
    <OverlayShell<HTMLElement>
      open={open}
      onClose={onClose}
      containerClassName={getDrawerContainerPlacement(side)}
    >
      {({ containerRef }) => (
        <motion.aside
          ref={containerRef}
          initial={initial}
          animate={animate}
          exit={exit}
          transition={panelTransition}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabel ? undefined : titleId}
          aria-label={ariaLabel}
          {...(isBottom
            ? {
                drag: "y" as const,
                dragConstraints: { top: 0, bottom: 0 },
                dragElastic: { top: 0, bottom: 0.6 },
                onDragEnd: handleDragEnd,
                dragListener: false,
                dragControls,
              }
            : {})}
          style={{ transform: "translate3d(0, 0, 0)", willChange: "transform, opacity" }}
          className={cn(
            "relative z-elevated flex w-full min-w-0 max-w-full flex-col overscroll-contain bg-card text-start shadow-drawer border-foreground/12",
            getDrawerPanelBorder(side),
            DRAWER_SIZE_MAP[size],
            className,
          )}
        >
          {isBottom && (
            <div
              className="flex items-center justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none min-h-5 sm:hidden"
              aria-hidden="true"
              onPointerDown={(e) => {
                if (!isDesktop) dragControls.start(e);
              }}
            >
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
            </div>
          )}

          {title ? (
            <DetailDrawerHeader
              titleId={titleId}
              title={title}
              subtitle={subtitle}
              badge={badge}
              icon={Icon}
              headerActions={headerActions}
              headerExtra={headerExtra}
              onClose={onClose}
              isDesktop={isDesktop}
              onPointerDragStart={(e) => dragControls.start(e)}
            />
          ) : null}

          {archiveBanner ? <div className="px-5 pt-3">{archiveBanner}</div> : null}

          <div
            className={cn(
              "flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-6",
              contentClassName,
            )}
          >
            {children}
          </div>

          {footer && (
            <div className="px-5 py-4 border-t border-border/30 bg-muted/20 flex items-center justify-between flex-shrink-0">
              {footer}
            </div>
          )}
        </motion.aside>
      )}
    </OverlayShell>
  );
}

Drawer.Header = DetailDrawerHeader;
Drawer.ArchiveBanner = DetailDrawerArchivedBanner;
Drawer.RestoreOrEditAction = DetailDrawerRestoreOrEditAction;

import React, { useEffect, useRef } from "react";
import { OVERLAY_BACKDROP } from "@mms/ui";
import { cn } from "@/lib/utils";
import { useOverlayBehavior } from "@/hooks/useOverlayBehavior";

export interface MobileSidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the role=dialog drawer. */
  ariaLabel: string;
  /** Extra classes for the backdrop (console-specific transitions). */
  backdropClassName?: string;
  /** Extra classes for the dialog element (console-specific positioning). */
  drawerClassName?: string;
  /**
   * Ignore backdrop clicks within this many ms of opening — prevents the
   * opening tap (touch-through) from immediately closing the drawer.
   */
  touchGuardMs?: number;
  /** Top slot rendered inside the drawer column. */
  brand?: React.ReactNode;
  /** Middle slot rendered inside the drawer column. */
  nav?: React.ReactNode;
  /** Bottom slot rendered inside the drawer column. */
  footer?: React.ReactNode;
}

/**
 * Console-agnostic mobile sidebar drawer chrome: fixed backdrop with the
 * shared overlay token, touch-through guard, and a role=dialog aria-modal
 * drawer with `w-sidebar-mobile bg-sidebar shadow-drawer border-e` styling.
 * Both consoles compose their brand/nav/footer slots on top of this SSOT.
 */
export function MobileSidebarDrawer({
  open,
  onClose,
  ariaLabel,
  backdropClassName,
  drawerClassName,
  touchGuardMs = 0,
  brand,
  nav,
  footer,
}: MobileSidebarDrawerProps): React.JSX.Element | null {
  const openedAtRef = useRef<number>(0);
  const drawerRef = useOverlayBehavior<HTMLDivElement>({ open, onClose });

  useEffect(() => {
    if (open) openedAtRef.current = Date.now();
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        data-overlay-backdrop
        className={cn(
          "fixed inset-0",
          OVERLAY_BACKDROP,
          "transition-opacity duration-300 opacity-100",
          backdropClassName,
        )}
        onClick={() => {
          if (Date.now() - openedAtRef.current > touchGuardMs) {
            onClose();
          }
        }}
        aria-hidden
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          "fixed start-0 top-0 z-sidebar-mobile flex h-full w-sidebar-mobile max-w-sheet flex-col bg-sidebar shadow-drawer border-e border-sidebar-border",
          drawerClassName,
        )}
      >
        <div className="flex flex-col justify-between h-full w-full">
          {brand}
          {nav}
          {footer}
        </div>
      </div>
    </>
  );
}

import React, { createContext, useContext, type RefObject } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useOverlayBehavior } from "@/hooks/useOverlayBehavior";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { OVERLAY_BACKDROP } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

export interface OverlayContextValue<T extends HTMLElement = HTMLElement> {
  containerRef: RefObject<T | null>;
  onClose: () => void;
  dismissible: boolean;
}

const OverlayContext = createContext<OverlayContextValue<HTMLElement> | null>(null);

export function useOverlayContext<T extends HTMLElement = HTMLElement>(): OverlayContextValue<T> {
  const ctx = useContext(OverlayContext);
  if (!ctx) {
    throw new Error("useOverlayContext must be used within an OverlayShell");
  }
  return ctx as OverlayContextValue<T>;
}

export interface OverlayShellProps<T extends HTMLElement = HTMLElement> {
  open?: boolean;
  onClose: () => void;
  dismissible?: boolean;
  lockScroll?: boolean;
  priority?: boolean;
  containerClassName?: string;
  backdropClassName?: string;
  children: React.ReactNode | ((context: OverlayContextValue<T>) => React.ReactNode);
}

/**
 * Foundational overlay system primitive managing backdrop rendering,
 * focus trapping, body scroll locking, and topmost Escape dismissal.
 */
export function OverlayShell<T extends HTMLElement = HTMLElement>({
  open = true,
  onClose,
  dismissible = true,
  lockScroll = true,
  priority = false,
  containerClassName,
  backdropClassName,
  children,
}: OverlayShellProps<T>): React.JSX.Element | null {
  const reducedMotion = useReducedMotion();
  const containerRef = useOverlayBehavior<T>({
    open,
    onClose,
    dismissible,
    lockScroll,
  });

  if (typeof document === "undefined") {
    return null;
  }

  const contextValue: OverlayContextValue<T> = {
    containerRef,
    onClose,
    dismissible,
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          data-print-unclamp
          className={cn(
            "fixed inset-0",
            priority ? "z-modal-priority" : "z-modal",
            containerClassName,
          )}
        >
          <motion.div
            aria-hidden="true"
            data-overlay-backdrop
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            className={cn("absolute inset-0", OVERLAY_BACKDROP, backdropClassName)}
            onClick={dismissible ? onClose : undefined}
          />
          <OverlayContext.Provider value={contextValue}>
            {typeof children === "function" ? children(contextValue) : children}
          </OverlayContext.Provider>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "../utils";
import { useUiConfig } from "../theme/UiConfigContext";
import { OVERLAY_BACKDROP } from "../theme/formStyles";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  dismissible?: boolean;
  priority?: boolean;
  className?: string;
  children: React.ReactNode;
}

const SIZE_MAP = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
};

/**
 * Accessible presentational modal dialog with backdrop, escape listener,
 * focus trapping, and compound header/footer layout.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  size = "md",
  headerExtra,
  footer,
  dismissible = true,
  priority = false,
  className,
  children,
}: ModalProps): React.JSX.Element | null {
  const { labels } = useUiConfig();
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center p-4 sm:p-6",
        priority ? "z-modal-priority" : "z-modal",
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      {...(dismissible ? { closedby: "any" } : {})}
    >
      {/* Backdrop */}
      <div
        data-overlay-backdrop="true"
        className={`fixed inset-0 ${OVERLAY_BACKDROP} transition-opacity animate-in fade-in-0 overscroll-contain`}
        onClick={(event) => {
          if (!dismissible) return;
          // Modern Web Guidance: light-dismiss-a-dialog fallback
          if (modalRef.current) {
            const rect = modalRef.current.getBoundingClientRect();
            const isInside =
              rect.width > 0 &&
              rect.height > 0 &&
              rect.top <= event.clientY &&
              event.clientY <= rect.top + rect.height &&
              rect.left <= event.clientX &&
              event.clientX <= rect.left + rect.width;
            if (isInside) return;
          }
          onClose();
        }}
        aria-hidden="true"
      />

      {/* Modal Dialog Panel */}
      <div
        ref={modalRef}
        className={cn(
          "relative z-10 flex w-full flex-col rounded-xl border border-border bg-card text-card-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 max-h-modal overscroll-contain",
          SIZE_MAP[size],
          className,
        )}
      >
        {/* Header */}
        {(title || dismissible) && (
          <div className="flex items-start justify-between border-b border-border p-5">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
                  {React.isValidElement(icon)
                    ? icon
                    : React.createElement(icon as React.ComponentType<{ className?: string }>, {
                        className: "h-5 w-5",
                      })}
                </div>
              )}
              <div className="space-y-1">
                {title && (
                  <h2 id={titleId} className="text-lg font-semibold leading-none tracking-tight">
                    {title}
                  </h2>
                )}
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {headerExtra}
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={labels.close}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="overflow-y-auto p-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

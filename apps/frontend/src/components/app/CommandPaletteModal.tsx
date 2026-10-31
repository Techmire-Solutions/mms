import React from "react";
import { Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useOverlayBehavior } from "@/hooks/useOverlayBehavior";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OVERLAY_BACKDROP } from "@/components/ui/formStyles";

export interface CommandPaletteModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  screenReaderAnnouncement?: string;
  listboxId: string;
  activeDescendantId?: string;
  children: React.ReactNode;
  footerTitle?: string;
  footerTrailing?: React.ReactNode;
  className?: string;
  dialogClassName?: string;
}

/**
 * Universal CommandPaletteModal primitive.
 * Enforces SSOT for overlay backdrop, motion animations, accessibility roles,
 * search input bar, and keyboard shortcuts across tenant and platform consoles.
 */
export function CommandPaletteModal({
  open,
  onClose,
  ariaLabel,
  searchPlaceholder,
  query,
  onQueryChange,
  onKeyDown,
  screenReaderAnnouncement,
  listboxId,
  activeDescendantId,
  children,
  footerTitle,
  footerTrailing,
  className,
  dialogClassName,
}: CommandPaletteModalProps): React.JSX.Element | null {
  const reducedMotion = useReducedMotion();
  // Focus trap + topmost-only Escape + focus return. Previously this dialog
  // declared aria-modal but let Tab escape into the page behind it, and Escape
  // only worked while the search input held focus.
  const containerRef = useOverlayBehavior<HTMLDivElement>({ open, onClose, lockScroll: true });

  if (!open) return null;

  return (
    <AnimatePresence>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- Backdrop dismiss; Escape and focus trap managed by useOverlayBehavior */}
      <div
        ref={containerRef}
        data-overlay-backdrop
        className={cn(
          "fixed inset-0 z-modal flex items-start justify-center pt-16 px-4",
          OVERLAY_BACKDROP,
          className,
        )}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, scale: 0.96, y: -8 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "relative w-full max-w-xl overflow-hidden rounded-xl surface-overlay",
            dialogClassName,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Bar Header */}
          <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
            <Search
              className="h-5 w-5 shrink-0 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <Input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground border-0 shadow-none focus-visible:ring-0 px-0 min-h-11 h-11"
              aria-label={searchPlaceholder}
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={activeDescendantId}
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted/60 px-2 py-0.5 text-2xs font-mono font-bold text-muted-foreground select-none">
              ESC
            </kbd>
          </div>

          {/* Screen reader live announcement */}
          {screenReaderAnnouncement ? (
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {screenReaderAnnouncement}
            </div>
          ) : null}

          {/* Results List */}
          {children}

          {/* Footer Shortcuts Bar */}
          {footerTitle || footerTrailing ? (
            <div className="border-t border-border/50 px-4 py-2 bg-muted/30 flex items-center justify-between text-3xs text-muted-foreground font-medium select-none">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-background px-1 py-0.2 font-mono text-2xs">
                    ↑
                  </kbd>
                  <kbd className="rounded border border-border bg-background px-1 py-0.2 font-mono text-2xs">
                    ↓
                  </kbd>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-background px-1 py-0.2 font-mono text-2xs">
                    ↵
                  </kbd>
                </span>
              </div>
              {footerTrailing ??
                (footerTitle ? (
                  <span className="hidden sm:inline font-semibold">{footerTitle}</span>
                ) : null)}
            </div>
          ) : null}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React from "react";
import { toast } from "@mms/ui";
import { ToastAction } from "@mms/ui";

/**
 * Canonical, DRY notification API for the whole app.
 *
 * Every user-facing toast goes through `notify` so variants, durations, and
 * colours stay consistent and theme-token driven. Never call the low-level
 * `toast()` directly from feature code.
 *
 * @example
 * notify.success(t('contacts.form.contactCreated'), { description: `${name} saved.` });
 * notify.error(t('contacts.form.pleaseFixErrors'), { description: firstError.message });
 * notify.archivedWithUndo(t('common.recordArchived'), () => restore(id));
 */

/** Standard auto-dismiss durations (ms). */
export const NOTIFY_DURATION = {
  short: 3000,
  default: 5000,
  long: 8000,
} as const;

type ToastReturn = ReturnType<typeof toast>;

export interface NotifyOptions {
  /** Secondary line under the title. */
  description?: string;
  /** Action node (e.g. Undo button). */
  action?: React.ReactNode;
  /** Override the auto-dismiss delay. Pass `Infinity` for a sticky toast. */
  duration?: number;
}

export interface NotifyArchivedUndoOptions {
  description?: string;
  undoLabel?: string;
  duration?: number;
}

type NotifyVariant = "default" | "success" | "destructive" | "warning" | "info";

function make(variant: NotifyVariant, fallbackDuration: number) {
  return (title: string, options: NotifyOptions = {}): ToastReturn =>
    toast({
      title,
      description: options.description,
      action: options.action,
      variant,
      duration: options.duration ?? fallbackDuration,
    });
}

export const notify = {
  /** Positive confirmation (create, update, import, merge…). */
  success: make("success", NOTIFY_DURATION.default),
  /** Failure / validation error. Stays longer so the user can read it. */
  error: make("destructive", NOTIFY_DURATION.long),
  /** Caution / non-blocking problem. */
  warning: make("warning", NOTIFY_DURATION.long),
  /** Neutral information (deletions, background events). */
  info: make("info", NOTIFY_DURATION.default),
  /** Plain, theme-neutral message. */
  message: make("default", NOTIFY_DURATION.default),
  /**
   * Optimistic soft-delete toast with an accessible Undo action button (§7.8).
   * Displays the archival notification with a 5–10s grace window (default 8000ms).
   */
  archivedWithUndo: (
    title: string,
    onUndo: () => void | Promise<void>,
    options: NotifyArchivedUndoOptions = {},
  ): ToastReturn => {
    const { undoLabel = "Undo", description, duration = NOTIFY_DURATION.long } = options;
    return toast({
      title,
      description,
      variant: "default",
      duration,
      action: React.createElement(
        ToastAction,
        {
          role: "button",
          tabIndex: 0,
          onClick: () => {
            void onUndo();
          },
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              void onUndo();
            }
          },
          className: "cursor-pointer select-none",
        },
        undoLabel,
      ),
    });
  },
} as const;

export type Notify = typeof notify;

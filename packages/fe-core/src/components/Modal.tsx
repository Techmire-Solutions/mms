import React, { useId } from "react";
import { m } from "framer-motion";
import { OverlayShell } from "./OverlayShell";
import { ModalHeader } from "./ModalHeader";
import { FormModalTabs } from "./FormModalTabs";
import { FormModalFooter } from "./FormModalFooter";
import { FormErrorBanner } from "./FormErrorBanner";
import type { SubTab } from "@mms/ui/app/SubTabBar";
import { useTranslation } from "../i18n/index.js";
import { useReducedMotion } from "../tenant/index.js";
import { cn } from "@mms/ui";

export interface ModalProps<K extends string = string> {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Accessible name for a dialog rendered without a `title` (WCAG 4.1.2). */
  ariaLabel?: string;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  headerExtra?: React.ReactNode;
  headerActions?: React.ReactNode;
  panelClassName?: string;
  footer?: React.ReactNode;
  priority?: boolean;
  dismissible?: boolean;
  /** Announces an in-flight save to assistive tech (`aria-busy`) and blocks dismissal. */
  busy?: boolean;
  children: React.ReactNode;
  // Consolidated FormModal capabilities
  progress?: number;
  progressLabel?: React.ReactNode;
  error?: string | readonly string[];
  /** Turns each banner message into a button that focuses the offending field. */
  onSelectError?: (index: number) => void;
  tabs?: readonly SubTab<K>[];
  activeTab?: K;
  onTabChange?: (key: K) => void;
  dir?: "ltr" | "rtl";
  cancelLabel?: string;
  saveLabel?: string;
  onSave?: (options?: { keepOpen?: boolean }) => void | Promise<unknown>;
  isDirty?: boolean;
  saving?: boolean;
  saveDisabled?: boolean;
  saved?: boolean;
  savedLabel?: string;
  footerStart?: React.ReactNode;
  hideFooter?: boolean;
  formId?: string;
  /** Footer save-button treatment; destructive for irreversible confirmations. */
  saveVariant?: "primary" | "destructive";
}

const SIZE = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
  "3xl": "max-w-modal-3xl",
};

/**
 * Unified accessible Modal primitive supporting modal headers, tab headers,
 * form footers, progress indicators, and compound component composition.
 */
export function Modal<K extends string = string>({
  open,
  onClose,
  title,
  ariaLabel,
  subtitle,
  icon,
  size = "md",
  headerExtra,
  headerActions,
  panelClassName,
  footer,
  priority = false,
  dismissible = true,
  busy = false,
  children,
  progress,
  progressLabel,
  error,
  onSelectError,
  tabs,
  activeTab,
  onTabChange,
  dir,
  cancelLabel,
  saveLabel,
  onSave,
  saving = false,
  saveDisabled = false,
  saved = false,
  savedLabel,
  footerStart,
  hideFooter = false,
  formId,
  saveVariant = "primary",
}: ModalProps<K>): React.JSX.Element | null {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  const hasTabs = Boolean(tabs && tabs.length > 1 && activeTab !== undefined);
  const effectiveSize =
    size === "xl" || size === "2xl" || size === "3xl" ? size : hasTabs ? "xl" : size;

  const errors = (() => {
    if (!error) return [];
    return (Array.isArray(error) ? error : [error]).filter(Boolean);
  })();

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (
      event.key !== "Enter" ||
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      formId ||
      !onSave ||
      saving ||
      saveDisabled
    ) {
      return;
    }
    const target = event.target as HTMLElement;
    if (!(target instanceof HTMLInputElement)) return;
    if (["checkbox", "radio", "file", "button", "submit", "reset"].includes(target.type)) {
      return;
    }
    if (target.closest('[role="listbox"], [role="menu"], [aria-expanded="true"]')) return;
    event.preventDefault();
    void onSave();
  };

  const resolvedFooter = (() => {
    if (footer !== undefined) return footer;
    if (hideFooter || !onSave) return null;
    return (
      <FormModalFooter
        footerStart={footerStart}
        cancelLabel={cancelLabel ?? t("common.cancel")}
        saveLabel={saveLabel ?? t("common.save")}
        savedLabel={savedLabel}
        onClose={onClose}
        onSave={() => {
          void onSave();
        }}
        saving={saving}
        saveDisabled={saveDisabled}
        saved={saved}
        form={formId}
        saveVariant={saveVariant}
      />
    );
  })();

  return (
    <OverlayShell<HTMLDivElement>
      open={open}
      onClose={onClose}
      dismissible={dismissible}
      priority={priority}
      containerClassName="flex items-center justify-center p-3 sm:p-4 print:p-0 print:m-0 print:block"
    >
      {({ containerRef }) => (
        <m.div
          ref={containerRef}
          initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: reducedMotion ? 0 : 0.18, ease: "easeOut" }}
          role="dialog"
          aria-modal="true"
          onKeyDown={handlePanelKeyDown}
          aria-busy={busy || undefined}
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : ariaLabel}
          data-print-unclamp
          className={cn(
            "relative @container bg-card rounded-2xl border border-foreground/12 shadow-surface-lg w-full z-elevated max-h-modal flex flex-col min-w-0 print:border-none print:shadow-none print:rounded-none print:bg-transparent print:p-0 print:m-0 print:max-h-none print:overflow-visible print:w-auto",
            SIZE[effectiveSize],
            panelClassName,
          )}
        >
          {title ? (
            <ModalHeader
              titleId={titleId}
              title={title}
              subtitle={subtitle}
              icon={icon}
              headerActions={headerActions}
              headerExtra={headerExtra}
              progress={progress}
              progressLabel={progressLabel}
              onClose={onClose}
              dismissible={dismissible}
              className="print:hidden"
            />
          ) : null}

          {errors.length > 0 && (
            <div data-print-hide className="print:hidden">
              <FormErrorBanner errors={errors} onSelectError={onSelectError} />
            </div>
          )}

          <div
            className={cn(
              "flex-1 overscroll-contain p-4 sm:p-6 print:p-0 print:m-0 print:overflow-visible print:space-y-0",
              tabs && activeTab !== undefined && onTabChange
                ? "overflow-hidden flex flex-col min-h-0"
                : "overflow-y-auto space-y-4",
            )}
          >
            {tabs && activeTab !== undefined && onTabChange ? (
              <FormModalTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} dir={dir}>
                {children}
              </FormModalTabs>
            ) : (
              children
            )}
          </div>

          {resolvedFooter && (
            <div
              data-slot="modal-footer"
              data-print-hide
              className="relative z-20 px-4 py-3 sm:px-6 border-t border-border/40 bg-muted/20 flex items-center justify-end rounded-b-2xl print:hidden"
            >
              {resolvedFooter}
            </div>
          )}
        </m.div>
      )}
    </OverlayShell>
  );
}

Modal.Header = ModalHeader;
Modal.Tabs = FormModalTabs;
Modal.Footer = FormModalFooter;
Modal.Error = FormErrorBanner;

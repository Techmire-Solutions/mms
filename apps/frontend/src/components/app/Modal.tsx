import React, { useId } from "react";
import { motion } from "framer-motion";
import { OverlayShell } from "@/components/app/OverlayShell";
import { ModalHeader } from "@/components/app/ModalHeader";
import { FormModalTabs } from "@/components/app/FormModalTabs";
import { FormModalFooter } from "@/components/app/FormModalFooter";
import { FormErrorBanner } from "@/components/app/FormErrorBanner";
import type { SubTab } from "@/components/app/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export interface ModalProps<K extends string = string> {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  headerExtra?: React.ReactNode;
  headerActions?: React.ReactNode;
  panelClassName?: string;
  footer?: React.ReactNode;
  priority?: boolean;
  dismissible?: boolean;
  children: React.ReactNode;
  // Consolidated FormModal capabilities
  progress?: number;
  progressLabel?: React.ReactNode;
  error?: string | readonly string[];
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
  subtitle,
  icon,
  size = "md",
  headerExtra,
  headerActions,
  panelClassName,
  footer,
  priority = false,
  dismissible = true,
  children,
  progress,
  progressLabel,
  error,
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
}: ModalProps<K>): React.JSX.Element | null {
  const { t } = useTranslation();
  const titleId = useId();
  const hasTabs = Boolean(tabs && tabs.length > 1 && activeTab !== undefined);
  const effectiveSize =
    size === "xl" || size === "2xl" || size === "3xl" ? size : hasTabs ? "xl" : size;

  const errors = (() => {
    if (!error) return [];
    return (Array.isArray(error) ? error : [error]).filter(Boolean);
  })();

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
      />
    );
  })();

  return (
    <OverlayShell<HTMLDivElement>
      open={open}
      onClose={onClose}
      dismissible={dismissible}
      priority={priority}
      containerClassName="flex items-center justify-center p-3 sm:p-4"
    >
      {({ containerRef }) => (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          data-print-unclamp
          className={cn(
            "relative @container bg-card rounded-2xl border border-foreground/12 shadow-surface-lg w-full z-elevated max-h-modal flex flex-col min-w-0",
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
            />
          ) : null}

          {errors.length > 0 && <FormErrorBanner errors={errors} />}

          <div
            className={cn(
              "flex-1 overscroll-contain p-4 sm:p-6",
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
            <div className="relative z-20 px-4 py-3 sm:px-6 border-t border-border/40 bg-muted/20 flex items-center justify-end rounded-b-2xl">
              {resolvedFooter}
            </div>
          )}
        </motion.div>
      )}
    </OverlayShell>
  );
}

Modal.Header = ModalHeader;
Modal.Tabs = FormModalTabs;
Modal.Footer = FormModalFooter;
Modal.Error = FormErrorBanner;

import React, { useState } from "react";
import { Modal, type ModalProps } from "@/components/app/Modal";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { useFormModalLayout } from "@/components/app/useFormModalLayout";
import { useTranslation } from "@/hooks/useTranslation";
import type { SubTab } from "@/components/app/SubTabBar";

export type { SubTab as FormModalTab };

export interface FormModalProps<K extends string = string> extends ModalProps<K> {
  tall?: boolean;
  tabPanelIdPrefix?: string;
  showBuilderToggle?: boolean;
  builderMode?: boolean;
  onBuilderModeChange?: (active: boolean) => void;
  saveOnTabChange?: boolean;
  /** When set with isDirty, close is intercepted by a discard confirm dialog. */
  discardUnsavedTitle?: string;
  discardUnsavedDescription?: string;
  discardConfirmLabel?: string;
  discardCancelLabel?: string;
}

/**
 * Canonical accessible FormModal primitive supporting form headers, tab headers,
 * form footers, progress indicators, dirty-state validation, and tall scrollable layouts.
 */
export function FormModal<K extends string = string>({
  open,
  onClose,
  title,
  subtitle,
  icon,
  size = "lg",
  panelClassName: panelClassNameProp,
  tall = false,
  progress,
  progressLabel,
  headerExtra,
  error,
  onSelectError,
  tabs,
  activeTab,
  onTabChange,
  tabPanelIdPrefix: _tabPanelIdPrefix,
  dir,
  dismissible = true,
  cancelLabel,
  saveLabel,
  onSave,
  isDirty = false,
  saving = false,
  saveDisabled = false,
  saved = false,
  savedLabel,
  footerStart,
  hideFooter = false,
  saveVariant = "primary",
  showBuilderToggle = false,
  builderMode = false,
  onBuilderModeChange,
  priority = false,
  saveOnTabChange = true,
  formId,
  discardUnsavedTitle,
  discardUnsavedDescription,
  discardConfirmLabel,
  discardCancelLabel,
  children,
}: FormModalProps<K>): React.JSX.Element | null {
  const { t } = useTranslation();
  const [discardOpen, setDiscardOpen] = useState(false);

  // A dirty form always asks before discarding, even when the caller only passed
  // `isDirty`. Callers can still override the copy/actions.
  const discardTitle = discardUnsavedTitle ?? (isDirty ? t("settings.unsavedChanges") : undefined);
  const discardDescription =
    discardUnsavedDescription ?? (isDirty ? t("common.discardUnsavedDescription") : "");
  const discardConfirm = discardConfirmLabel ?? t("common.yes");
  const discardCancel = discardCancelLabel ?? t("common.cancel");

  const handleTabChange = async (nextTab: K) => {
    if (nextTab === activeTab) return;
    if (saveOnTabChange && isDirty && onSave && !saveDisabled && !saving) {
      try {
        const result = await onSave({ keepOpen: true });
        if (result === false) return;
      } catch {
        return;
      }
    }
    onTabChange?.(nextTab);
  };

  const requestClose = () => {
    if (isDirty && discardTitle) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  };

  const { panelClassName, effectiveSize, resolvedHeaderExtra, headerActions } = useFormModalLayout({
    open,
    size: size as "sm" | "md" | "lg" | "xl" | "2xl" | "3xl",
    tall,
    progress,
    progressLabel,
    headerExtra,
    tabs,
    activeTab,
    builderMode,
    showBuilderToggle,
    onBuilderModeChange,
    panelClassNameProp,
  });

  return (
    <>
      <Modal
        open={open}
        onClose={requestClose}
        title={title}
        subtitle={subtitle}
        icon={icon}
        size={effectiveSize}
        headerExtra={resolvedHeaderExtra}
        headerActions={headerActions}
        panelClassName={panelClassName}
        priority={priority}
        dismissible={dismissible && !saving}
        busy={saving}
        error={error}
        onSelectError={onSelectError}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        dir={dir}
        cancelLabel={cancelLabel}
        saveLabel={saveLabel}
        onSave={onSave}
        saving={saving}
        saveDisabled={saveDisabled}
        saved={saved}
        savedLabel={savedLabel}
        footerStart={footerStart}
        hideFooter={hideFooter || builderMode}
        formId={formId}
        saveVariant={saveVariant}
      >
        {children}
      </Modal>
      {discardTitle ? (
        <ConfirmAlertDialog
          open={discardOpen}
          onOpenChange={setDiscardOpen}
          title={discardTitle}
          description={discardDescription}
          confirmLabel={discardConfirm}
          cancelLabel={discardCancel}
          destructive
          onConfirm={onClose}
        />
      ) : null}
    </>
  );
}

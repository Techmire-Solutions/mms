/**
 * @file TemplateEditor.tsx
 * @description Global DRY Single Source of Truth (SSOT) Document Template Editor.
 * Parametric over document payload schemas with native Typst and Zoho sync integrations.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  TemplateEditorKeyboardHints,
  TemplateEditorPaneSwitcher,
  TemplateEditorPanes,
  TemplateEditorPrintRules,
  TemplateEditorToolbar,
  useTemplateEditor,
  useTemplateEditorExport,
  useTemplateEditorModal,
  type EditorPane,
  type TemplateEditorBranding,
  type TemplateEditorProps,
} from "./template-editor";

export type { TemplateEditorBranding, TemplateEditorProps };

const DEFAULT_FALLBACK_BRANDING: TemplateEditorBranding = {
  logoUrl: null,
  primaryColor: undefined,
  secondaryColor: undefined,
};

export function TemplateEditor<TPayload = Record<string, unknown>>({
  title,
  template: initialTemplate,
  defaultTemplate,
  availableFields = [],
  presets = [],
  documentType,
  sampleData,
  fullscreen = true,
  onSave,
  onClose,
  onExportTypst,
  onExportZoho,
  onPrint,
  onChange,
  onDirtyChange,
  branding: brandingProp,
}: TemplateEditorProps<TPayload>): React.JSX.Element {
  const [pane, setPane] = useState<EditorPane>("canvas");
  const branding = brandingProp ?? DEFAULT_FALLBACK_BRANDING;
  const titleId = useId();

  // The editor's Escape/Ctrl-close handler must invoke the modal's close logic,
  // but the modal needs the editor's live `isDirty` — a circular dependency.
  // Break it with a stable indirection so neither value is read a render late.
  const modalCloseRef = useRef<() => void>(() => {});
  const handleEditorClose = useCallback(() => modalCloseRef.current(), []);

  const editor = useTemplateEditor<TPayload>({
    initialTemplate,
    defaultTemplate,
    availableFields,
    presets,
    documentType,
    onSave,
    onClose: handleEditorClose,
  });

  const confirmDiscardPrompt = useCallback(
    () => window.confirm(editor.t("templateEditor.discardUnsavedPrompt")),
    [editor.t],
  );

  const hasSelection = editor.selectedIds.length > 0;
  const modal = useTemplateEditorModal({
    initialFullscreen: fullscreen,
    isDirty: editor.isDirty,
    onClose,
    confirmDiscardPrompt,
    // Escape clears the selection first (the shortcut layer owns that press); only a
    // second Escape with nothing selected leaves the editor.
    ignoreEscapeWhen: () => hasSelection,
  });

  useEffect(() => {
    modalCloseRef.current = modal.handleClose;
  }, [modal.handleClose]);

  /* Deleting unmounts the activated control, so recover focus and announce the change. */
  const deletionNonce = editor.deletionNotice?.nonce ?? 0;
  useEffect(() => {
    if (deletionNonce) editor.canvasViewportRef.current?.focus();
  }, [deletionNonce, editor.canvasViewportRef]);

  useEffect(() => {
    onDirtyChange?.(editor.isDirty);
  }, [editor.isDirty, onDirtyChange]);
  useEffect(() => {
    onChange?.(editor.template);
  }, [editor.template, onChange]);

  const { isExporting, handlePrint, handleExportTypst, handleExportZoho } = useTemplateEditorExport(
    {
      template: editor.template,
      sampleData,
      onExportTypst,
      onExportZoho,
      onPrint,
      t: editor.t,
    },
  );

  const handleToggleGuides = useCallback(
    () => editor.setShowGuides((prev) => !prev),
    [editor.setShowGuides],
  );
  const handleTogglePreview = useCallback(
    () => editor.setIsPreviewMode((prev) => !prev),
    [editor.setIsPreviewMode],
  );

  const documentLabel = documentType
    ? documentType.charAt(0).toUpperCase() + documentType.slice(1)
    : "";
  const editorLabel =
    title ||
    (documentLabel
      ? editor.t("templateEditor.documentTitle", { document: documentLabel })
      : editor.t("templateEditor.title"));

  return (
    <div
      ref={modal.containerRef}
      tabIndex={-1}
      role={modal.isFullscreen ? "dialog" : "region"}
      aria-modal={modal.isFullscreen ? "true" : undefined}
      aria-labelledby={titleId}
      data-print-unclamp
      className={
        modal.isFullscreen
          ? "fixed inset-0 z-modal flex flex-col bg-background outline-hidden print:static print:bg-white print:overflow-visible print:border-none print:p-0 print:m-0"
          : "flex flex-col bg-background rounded-xl border border-border overflow-hidden h-[calc(100dvh-14rem)] min-h-144 max-h-216 outline-hidden print:static print:bg-white print:h-auto print:max-h-none print:overflow-visible print:border-none print:p-0 print:m-0"
      }
    >
      <TemplateEditorPrintRules
        width={editor.size.width}
        height={editor.size.height}
        orientation={editor.orientation}
      />

      <TemplateEditorToolbar
        /* `editorLabel` already applies the title → documentType → generic fallbacks. */
        title={editorLabel}
        titleId={titleId}
        template={editor.template}
        historyLength={editor.history.length}
        futureLength={editor.future.length}
        saved={editor.saved}
        saving={editor.saving}
        isDirty={editor.isDirty}
        showGuides={editor.showGuides}
        fullscreen={modal.isFullscreen}
        presets={presets}
        canvasScale={editor.canvasScale}
        isPreviewMode={editor.isPreviewMode}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onPageSizeChange={editor.handlePageSize}
        onOrientationChange={editor.handleOrientationChange}
        onToggleGuides={handleToggleGuides}
        onTogglePreview={handleTogglePreview}
        onZoomIn={editor.zoomIn}
        onZoomOut={editor.zoomOut}
        onZoomReset={editor.zoomReset}
        onZoomFit={editor.zoomFit}
        onExportJson={editor.exportTemplateJson}
        onImportJson={editor.importTemplateJson}
        onResetDefault={editor.resetToDefault}
        onApplyPreset={editor.applyPreset}
        onToggleFullscreen={modal.handleToggleFullscreen}
        onSave={editor.handleSave}
        onClose={modal.handleClose}
        onExportTypst={onExportTypst ? handleExportTypst : undefined}
        onExportZoho={onExportZoho ? handleExportZoho : undefined}
        onPrint={handlePrint}
        isExporting={isExporting}
        activePresetKey={editor.activePresetKey}
        t={editor.t}
      />

      <TemplateEditorPaneSwitcher value={pane} onChange={setPane} t={editor.t} />

      <TemplateEditorPanes
        pane={pane}
        editor={editor}
        availableFields={availableFields}
        sampleData={sampleData}
        branding={branding}
      />

      <TemplateEditorKeyboardHints t={editor.t} />

      {/* Polite status region: deletions only. Visually hidden, announced on change. */}
      <div role="status" aria-live="polite" className="sr-only">
        {editor.deletionNotice?.message ?? ""}
      </div>
    </div>
  );
}

export default TemplateEditor;

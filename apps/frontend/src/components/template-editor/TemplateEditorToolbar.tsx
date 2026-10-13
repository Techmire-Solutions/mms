import React from "react";
import type { DocumentTemplate, DocumentTemplatePreset } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { TemplateEditorToolbarTitle } from "./TemplateEditorToolbarTitle";
import { TemplateEditorHistoryControls } from "./TemplateEditorHistoryControls";
import { TemplateEditorToolbarCenter } from "./TemplateEditorToolbarCenter";
import { TemplateEditorHeaderActions } from "./TemplateEditorHeaderActions";

const Divider = () => <div className="h-6 w-px bg-border/60 mx-1 shrink-0" aria-hidden="true" />;

export interface TemplateEditorToolbarProps<TPayload = Record<string, unknown>> {
  title: string;
  titleId?: string;
  template: DocumentTemplate<TPayload>;
  isDirty: boolean;
  saved: boolean;
  saving?: boolean;
  historyLength: number;
  futureLength: number;
  canvasScale: number;
  fullscreen?: boolean;
  showGuides: boolean;
  isPreviewMode: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPageSizeChange: (size: string) => void;
  onOrientationChange: (orientation: "portrait" | "landscape") => void;
  onToggleGuides: () => void;
  onTogglePreview: () => void;
  onResetDefault: () => void;
  onToggleFullscreen?: () => void;
  onSave: () => void;
  onClose: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onZoomFit?: () => void;
  presets?: DocumentTemplatePreset<TPayload>[];
  activePresetKey?: string | null;
  onApplyPreset: (presetKey: string) => void;
  onExportJson?: () => void;
  onImportJson?: (file: File) => void;
  onExportTypst?: () => void;
  onExportZoho?: () => void;
  onPrint?: () => void;
  isExporting?: boolean;
  t: TranslationFunction;
}

export function TemplateEditorToolbar<TPayload = Record<string, unknown>>({
  title,
  titleId,
  template,
  isDirty = false,
  saved,
  saving = false,
  historyLength,
  futureLength,
  canvasScale,
  fullscreen = false,
  showGuides,
  isPreviewMode = false,
  onUndo,
  onRedo,
  onPageSizeChange,
  onOrientationChange,
  onToggleGuides,
  onTogglePreview,
  onResetDefault,
  onToggleFullscreen,
  onSave,
  onClose,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFit,
  presets = [],
  activePresetKey = null,
  onApplyPreset,
  onExportJson,
  onImportJson,
  onExportTypst,
  onExportZoho,
  onPrint,
  isExporting = false,
  t,
}: TemplateEditorToolbarProps<TPayload>): React.JSX.Element {
  return (
    <header className="flex items-center border-b border-border bg-card/95 backdrop-blur-sm flex-shrink-0 min-h-16 print:hidden relative">
      <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto overflow-y-hidden flex-1 min-w-0 [mask-image:linear-gradient(to_right,black_calc(100%-48px),transparent_100%)] rtl:[mask-image:linear-gradient(to_left,black_calc(100%-48px),transparent_100%)]">
        <TemplateEditorToolbarTitle
          title={title}
          titleId={titleId}
          isDirty={isDirty}
          saved={saved}
          t={t}
        />

        <Divider />

        <TemplateEditorHistoryControls
          onUndo={onUndo}
          onRedo={onRedo}
          historyLength={historyLength}
          futureLength={futureLength}
          saving={saving}
          t={t}
        />

        <Divider />

        <TemplateEditorToolbarCenter
          template={template}
          canvasScale={canvasScale}
          showGuides={showGuides}
          isPreviewMode={isPreviewMode}
          onPageSizeChange={onPageSizeChange}
          onOrientationChange={onOrientationChange}
          onToggleGuides={onToggleGuides}
          onTogglePreview={onTogglePreview}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onZoomReset={onZoomReset}
          onZoomFit={onZoomFit}
          presets={presets}
          activePresetKey={activePresetKey}
          saving={saving}
          isDirty={isDirty}
          onApplyPreset={onApplyPreset}
          onExportJson={onExportJson}
          onImportJson={onImportJson}
          onExportTypst={onExportTypst}
          onExportZoho={onExportZoho}
          onPrint={onPrint}
          isExporting={isExporting}
          t={t}
        />
      </div>

      <TemplateEditorHeaderActions
        onResetDefault={onResetDefault}
        onToggleFullscreen={onToggleFullscreen}
        fullscreen={fullscreen}
        onSave={onSave}
        onClose={onClose}
        saved={saved}
        saving={saving}
        t={t}
      />
    </header>
  );
}

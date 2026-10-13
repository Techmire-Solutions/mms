import React from "react";
import type { DocumentTemplate, DocumentTemplatePreset } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { TemplateEditorPageControls } from "./TemplateEditorPageControls";
import { TemplateEditorViewControls } from "./TemplateEditorViewControls";
import { TemplateEditorZoomControls } from "./TemplateEditorZoomControls";
import { TemplateEditorPresetsControl } from "./TemplateEditorPresetsControl";
import { TemplateEditorExportActions } from "./TemplateEditorExportActions";

const TOOLBAR_ICON_BUTTON =
  "touch-manipulation rounded-md transition-all shadow-none min-h-11 min-w-11";

const Divider = () => <div className="h-6 w-px bg-border/60 mx-1 shrink-0" aria-hidden="true" />;

export interface TemplateEditorToolbarCenterProps<TPayload = Record<string, unknown>> {
  template: DocumentTemplate<TPayload>;
  canvasScale: number;
  showGuides: boolean;
  isPreviewMode: boolean;
  onPageSizeChange: (size: string) => void;
  onOrientationChange: (orientation: "portrait" | "landscape") => void;
  onToggleGuides: () => void;
  onTogglePreview: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onZoomFit?: () => void;
  presets?: DocumentTemplatePreset<TPayload>[];
  activePresetKey?: string | null;
  saving?: boolean;
  isDirty?: boolean;
  onApplyPreset: (presetKey: string) => void;
  onExportJson?: () => void;
  onImportJson?: (file: File) => void;
  onExportTypst?: () => void;
  onExportZoho?: () => void;
  onPrint?: () => void;
  isExporting?: boolean;
  t: TranslationFunction;
}

export function TemplateEditorToolbarCenter<TPayload = Record<string, unknown>>({
  template,
  canvasScale,
  showGuides,
  isPreviewMode,
  onPageSizeChange,
  onOrientationChange,
  onToggleGuides,
  onTogglePreview,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFit,
  presets = [],
  activePresetKey = null,
  saving = false,
  isDirty = false,
  onApplyPreset,
  onExportJson,
  onImportJson,
  onExportTypst,
  onExportZoho,
  onPrint,
  isExporting = false,
  t,
}: TemplateEditorToolbarCenterProps<TPayload>): React.JSX.Element {
  return (
    <>
      <div className="shrink-0">
        <TemplateEditorPageControls
          pageSize={template.pageSize}
          orientation={template.orientation || "portrait"}
          onPageSizeChange={onPageSizeChange}
          onOrientationChange={onOrientationChange}
          t={t}
        />
      </div>

      <Divider />

      <TemplateEditorViewControls
        showGuides={showGuides}
        isPreviewMode={isPreviewMode}
        onToggleGuides={onToggleGuides}
        onTogglePreview={onTogglePreview}
        iconButtonClassName={TOOLBAR_ICON_BUTTON}
        t={t}
      />

      {onZoomIn && onZoomOut && (
        <>
          <Divider />
          <div className="shrink-0">
            <TemplateEditorZoomControls
              canvasScale={canvasScale}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
              onZoomReset={onZoomReset}
              onZoomFit={onZoomFit}
              t={t}
            />
          </div>
        </>
      )}

      {presets.length > 0 && (
        <>
          <Divider />
          <TemplateEditorPresetsControl
            presets={presets}
            activePresetKey={activePresetKey}
            saving={saving}
            isDirty={isDirty}
            onApplyPreset={onApplyPreset}
            t={t}
          />
        </>
      )}

      <div className="shrink-0">
        <TemplateEditorExportActions
          onExportJson={onExportJson}
          onImportJson={onImportJson}
          onExportTypst={onExportTypst}
          onExportZoho={onExportZoho}
          onPrint={onPrint}
          isExporting={isExporting}
          disabled={saving}
          t={t}
        />
      </div>
    </>
  );
}

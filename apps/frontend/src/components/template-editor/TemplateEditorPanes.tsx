/**
 * @file TemplateEditorPanes.tsx
 * @description 3-pane layout containing the palette, canvas visual surface, and properties inspector.
 */

import React from "react";
import type { TemplateFieldDefinition } from "@mms/shared";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { TemplateEditorElementPalette } from "./TemplateEditorElementPalette";
import { TemplateEditorCanvas } from "./TemplateEditorCanvas";
import { TemplateEditorPropertiesPanel } from "./TemplateEditorPropertiesPanel";
import type { EditorPane } from "./TemplateEditorPaneSwitcher";
import type { TemplateEditorBranding } from "./templateEditorTypes";
import type { useTemplateEditor } from "./useTemplateEditor";

export interface TemplateEditorPanesProps<TPayload = Record<string, unknown>> {
  pane: EditorPane;
  editor: ReturnType<typeof useTemplateEditor<TPayload>>;
  availableFields?: TemplateFieldDefinition<TPayload>[];
  sampleData?: TPayload;
  branding: TemplateEditorBranding;
}

export function TemplateEditorPanes<TPayload = Record<string, unknown>>({
  pane,
  editor,
  availableFields = [],
  sampleData,
  branding,
}: TemplateEditorPanesProps<TPayload>): React.JSX.Element {
  const paneClass = (candidate: EditorPane) => (pane === candidate ? "flex" : "hidden");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      {!editor.isPreviewMode && (
        /* `lg:contents` restores flex stretch at lg — see TemplateEditorPaneSwitcher. */
        <div className={`${paneClass("elements")} lg:contents`}>
          <TemplateEditorElementPalette
            availableFields={availableFields}
            onAddStaticText={editor.addStaticText}
            onAddHeading={editor.addHeading}
            onAddDivider={editor.addDivider}
            onAddQrCode={editor.addQrCode}
            onAddLogo={editor.addLogo}
            onAddField={editor.addField}
            onAddTable={editor.addTable}
            t={editor.t}
          />
        </div>
      )}
      <div
        /* `print:flex`: below lg an inactive pane is `hidden`, and print is not a screen. */
        className={`${paneClass("canvas")} lg:flex print:flex flex-1 min-h-80 relative flex-col overflow-hidden`}
      >
        <ErrorBoundary>
          <TemplateEditorCanvas
            template={editor.template}
            selectedId={editor.selectedId}
            selectedIds={editor.selectedIds}
            size={editor.size}
            canvasScale={editor.canvasScale}
            showGuides={editor.showGuides}
            isPreviewMode={editor.isPreviewMode}
            activeGuides={editor.activeGuides}
            isSpacePressed={editor.isSpacePressed}
            isPanning={editor.isPanning}
            onPointerDownViewport={editor.onPointerDownViewport}
            canvasViewportRef={editor.canvasViewportRef}
            canvasRef={editor.canvasRef}
            branding={branding}
            onDeselect={editor.deselectAll}
            onMouseDownElement={editor.onMouseDownElement}
            onMouseDownResize={editor.onMouseDownResize}
            onDeleteElement={editor.deleteElement}
            onSelectElements={editor.setSelectedIds}
            onSelectElement={editor.selectElement}
            flashElementId={editor.flashElementId}
            appDir={editor.isRtl ? "rtl" : "ltr"}
            sampleData={sampleData}
            t={editor.t}
          />
        </ErrorBoundary>
      </div>
      {!editor.isPreviewMode && (
        <div className={`${paneClass("properties")} lg:contents`}>
          <TemplateEditorPropertiesPanel
            selectedElement={editor.selectedElement}
            selectedElements={editor.selectedElements}
            elements={editor.template.elements}
            availableFields={availableFields}
            onSelectElement={editor.selectElement}
            onPatchElement={editor.patchElement}
            onPatchStyle={editor.patchStyle}
            onPatchSelectedStyles={editor.patchSelectedStyles}
            onDuplicateElement={editor.duplicateElement}
            onDeleteElement={editor.deleteElement}
            onDuplicateSelected={editor.duplicateSelected}
            onDeleteSelected={editor.deleteSelected}
            onAlignSelected={editor.alignSelected}
            onDistributeSelected={editor.distributeSelected}
            onCenterSelected={editor.centerSelected}
            onSnapSelected={editor.snapSelected}
            onBringToFront={editor.bringToFront}
            onSendToBack={editor.sendToBack}
            onBringSelectedToFront={editor.bringSelectedToFront}
            onSendSelectedToBack={editor.sendSelectedToBack}
            onMoveForward={editor.moveForward}
            onMoveBackward={editor.moveBackward}
            primaryColor={branding.primaryColor}
            secondaryColor={branding.secondaryColor}
            isRtl={editor.isRtl}
            t={editor.t}
          />
        </div>
      )}
    </div>
  );
}

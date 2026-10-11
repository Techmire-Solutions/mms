/**
 * @file TemplateEditorCanvas.tsx
 * @description Central interactive visual design surface with selection handles, marquee, drag-and-drop, and canvas empty state.
 */

import React from "react";
import { type DocumentTemplate, type PageSizeInfo } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { type SmartGuideLine } from "./templateEditorUtils";
import { useTemplateMarquee } from "./useTemplateMarquee";
import { TemplateElementRenderer } from "./TemplateElementRenderer";
import { TemplateEditorCanvasEmptyState } from "./TemplateEditorCanvasEmptyState";
import { TemplateEditorCanvasGuides } from "./TemplateEditorCanvasGuides";
import { TemplateEditorCanvasStatusPill } from "./TemplateEditorCanvasStatusPill";
import { TemplateEditorGridOverlay } from "./TemplateEditorGridOverlay";
import { TemplateEditorMarqueeOverlay } from "./TemplateEditorMarqueeOverlay";
import { TEMPLATE_PAGE_WRAPPER_ATTR } from "./useTemplateEditorZoom";
import type { ResizeHandle } from "./useTemplateEditorInteractions";

export interface TemplateEditorCanvasProps<TPayload = Record<string, unknown>> {
  template: DocumentTemplate<TPayload>;
  selectedId?: string | null;
  selectedIds: string[];
  size: PageSizeInfo;
  canvasScale: number;
  showGuides: boolean;
  isPreviewMode?: boolean;
  canvasViewportRef: React.RefObject<HTMLElement | null>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  branding: {
    logoUrl?: string | null;
  };
  printTokens?: never;
  onDeselect: () => void;
  onMouseDownElement: (event: React.MouseEvent, elementId: string) => void;
  onMouseDownResize: (event: React.MouseEvent, elementId: string, handle?: ResizeHandle) => void;
  onSelectElements?: (elementIds: string[]) => void;
  onDeleteElement: (elementId: string) => void;
  onSelectElement?: (elementId: string) => void;
  flashElementId?: string | null;
  appDir?: "ltr" | "rtl";
  sampleData?: TPayload;
  activeGuides?: SmartGuideLine[];
  isSpacePressed?: boolean;
  isPanning?: boolean;
  onPointerDownViewport?: (event: React.PointerEvent<HTMLElement>) => void;
  t: TranslationFunction;
}

export function TemplateEditorCanvas<TPayload = Record<string, unknown>>({
  template,
  selectedId,
  selectedIds,
  size,
  canvasScale,
  showGuides,
  isPreviewMode = false,
  canvasViewportRef,
  canvasRef,
  branding,
  onDeselect,
  onMouseDownElement,
  onMouseDownResize,
  onSelectElements,
  onDeleteElement,
  onSelectElement,
  flashElementId = null,
  appDir = "ltr",
  sampleData,
  activeGuides = [],
  isSpacePressed = false,
  isPanning = false,
  onPointerDownViewport,
  t,
}: TemplateEditorCanvasProps<TPayload>): React.JSX.Element {
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const focusTargetId = selectedId ?? template.elements[0]?.id ?? null;

  const { marquee, onPointerDownBackground } = useTemplateMarquee({
    canvasRef,
    canvasScale,
    size,
    elements: template.elements,
    selectedIds,
    isPreviewMode,
    isSpacePressed,
    onDeselect,
    onSelectElements,
  });

  React.useEffect(() => {
    if (!flashElementId) return;
    const viewport = canvasViewportRef.current;
    const element = template.elements.find((el) => el.id === flashElementId);
    if (!viewport || !element) return;
    const targetLeft = (element.x + element.w / 2) * canvasScale;
    const targetTop = (element.y + element.h / 2) * canvasScale;
    viewport.scrollTo({
      left: Math.max(0, targetLeft + 24 - viewport.clientWidth / 2),
      top: Math.max(0, targetTop + 24 - viewport.clientHeight / 2),
      behavior: "smooth",
    });
  }, [flashElementId, canvasScale, template.elements, canvasViewportRef]);

  return (
    <section
      ref={canvasViewportRef as React.RefObject<HTMLElement>}
      tabIndex={0}
      aria-label={t("templateEditor.canvasViewport")}
      onPointerDown={onPointerDownViewport}
      className={`flex-1 bg-muted/30 overflow-auto p-6 flex flex-col items-center justify-start relative min-h-80 select-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary print:p-0 print:m-0 print:bg-white print:overflow-visible ${
        isSpacePressed ? (isPanning ? "cursor-grabbing" : "cursor-grab") : ""
      }`}
    >
      <TemplateEditorCanvasStatusPill
        size={size}
        canvasScale={canvasScale}
        isPreviewMode={isPreviewMode}
        t={t}
      />

      <div
        {...{ [TEMPLATE_PAGE_WRAPPER_ATTR]: "" }}
        className="shrink-0 print:w-auto! print:h-auto!"
        style={{ width: size.width * canvasScale, height: size.height * canvasScale }}
      >
        <div
          ref={canvasRef}
          dir="ltr"
          onPointerDown={onPointerDownBackground}
          style={{
            width: size.width,
            height: size.height,
            transform: `scale(${canvasScale})`,
            transformOrigin: "top left",
            boxShadow:
              "0 25px 50px -12px rgba(0, 0, 0, 0.16), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.08)",
          }}
          className={`relative bg-white text-black select-none transition-shadow rounded-xs border border-border/40 shrink-0 print:border-none print:shadow-none print:m-0 print:transform-none ${
            isSpacePressed ? (isPanning ? "cursor-grabbing" : "cursor-grab") : ""
          }`}
        >
          <TemplateEditorGridOverlay showGuides={showGuides} isPreviewMode={isPreviewMode} t={t} />

          {!isPreviewMode && <TemplateEditorCanvasGuides activeGuides={activeGuides} />}

          {template.elements.length === 0 && (
            <TemplateEditorCanvasEmptyState isPreviewMode={isPreviewMode} t={t} />
          )}

          {template.elements.map((el) => (
            <TemplateElementRenderer
              key={el.id}
              el={el}
              isSelected={!isPreviewMode && (selectedSet.has(el.id) || selectedId === el.id)}
              isPreviewMode={isPreviewMode}
              isFocusTarget={focusTargetId === el.id}
              isNew={flashElementId === el.id}
              appDir={appDir}
              branding={branding}
              sampleData={sampleData}
              onMouseDownElement={onMouseDownElement}
              onMouseDownResize={onMouseDownResize}
              onDeleteElement={onDeleteElement}
              onSelectElement={onSelectElement}
              t={t}
            />
          ))}

          {!isPreviewMode && <TemplateEditorMarqueeOverlay marquee={marquee} />}
        </div>
      </div>
    </section>
  );
}

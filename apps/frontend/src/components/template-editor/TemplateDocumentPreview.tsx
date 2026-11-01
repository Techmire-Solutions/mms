/**
 * @file TemplateDocumentPreview.tsx
 * @description Single print/render surface for a document template + payload.
 *
 * Extracted from the Obligations invoice preview so every module's printed document
 * uses one element renderer (the same `TemplateElementContent` the editor canvas uses)
 * instead of hand-rolling a second, divergent layout.
 */

import React from "react";
import type { DocumentTemplate, TemplateElement } from "@mms/shared";
import { getPageDimensions } from "@mms/shared";
import { getPrintBrandingTokens } from "@/lib/ui/printBrandingTokens";
import { useTranslation } from "@/hooks/useTranslation";
import { interpolateTemplateTokens } from "./templateEditorUtils";
import { TemplateElementContent } from "./templateElementContent";
import { resolveElementGeometry } from "./templateDataResolution";

export interface TemplateDocumentPreviewProps<TPayload extends object = object> {
  template: DocumentTemplate<TPayload>;
  /** Flat field→value record the template elements bind to. */
  data?: TPayload | null;
  logoUrl?: string | null;
  /** Application writing direction; element direction still auto-detects script. */
  isRtl?: boolean;
  /** Uniform scale for on-screen previews (print containers should use 1). */
  scale?: number;
  showBoundary?: boolean;
  /** Adds a page break after the page (batch printing). */
  breakAfter?: boolean;
  /** Explicit QR payload (e.g. a verification URL); falls back to the element's binding. */
  qrPayload?: string | null;
  /** Editor-only selection affordances. Omit for print surfaces. */
  selectedId?: string | null;
  onSelect?: ((id: string) => void) | null;
  className?: string;
}

export function TemplateDocumentPreview<TPayload extends object = object>({
  template,
  data = null,
  logoUrl = null,
  isRtl = false,
  scale = 1,
  showBoundary = true,
  breakAfter = false,
  qrPayload = null,
  selectedId = null,
  onSelect = null,
  className = "",
}: TemplateDocumentPreviewProps<TPayload>): React.JSX.Element {
  const { t } = useTranslation();
  const printTokens = getPrintBrandingTokens();
  const size = getPageDimensions(template.pageSize, template.orientation);
  const appDir = isRtl ? "rtl" : "ltr";
  const fieldData = (data ?? null) as Record<string, unknown> | null;

  const renderElement = (templateElement: TemplateElement) => {
    const isSelected = selectedId === templateElement.id;
    const elementStyle = templateElement.style || {};
    const geometry = resolveElementGeometry(
      templateElement,
      appDir,
      fieldData?.[String(templateElement.field ?? "")] as string | undefined,
    );

    return (
      <div
        key={templateElement.id}
        dir={geometry.direction}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        aria-label={onSelect ? templateElement.label || t("templateEditor.element") : undefined}
        onClick={
          onSelect
            ? (event: React.MouseEvent) => {
                event.stopPropagation();
                onSelect(templateElement.id);
              }
            : undefined
        }
        onKeyDown={
          onSelect
            ? (event: React.KeyboardEvent) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(templateElement.id);
                }
              }
            : undefined
        }
        style={{
          position: "absolute",
          left: templateElement.x,
          top: templateElement.y,
          width: templateElement.w,
          height: templateElement.h,
          boxSizing: "border-box",
          fontSize: elementStyle.fontSize || 10,
          fontWeight: elementStyle.fontWeight || "normal",
          fontFamily: elementStyle.fontFamily || "inherit",
          fontStyle: elementStyle.fontStyle || "normal",
          textDecoration: elementStyle.textDecoration || "none",
          textAlign: geometry.textAlign,
          direction: geometry.direction,
          color: elementStyle.color || printTokens.text,
          backgroundColor: elementStyle.backgroundColor || "transparent",
          border: elementStyle.borderWidth
            ? `${elementStyle.borderWidth}px solid ${elementStyle.borderColor || printTokens.border}`
            : "none",
          borderRadius:
            elementStyle.borderRadius != null ? `${elementStyle.borderRadius}px` : undefined,
          /*
           * Text is allowed to overflow its box on paper rather than being clipped with
           * an ellipsis — a printed document must not silently drop half a value.
           */
          overflow: "visible",
          cursor: onSelect ? "pointer" : "default",
          boxShadow: isSelected ? `0 0 0 2px ${printTokens.primary}` : undefined,
        }}
      >
        <TemplateElementContent
          el={templateElement}
          data={fieldData}
          mode="print"
          logoUrl={logoUrl}
          qrPayload={qrPayload}
          hideMissingLogo
          geometry={geometry}
          interpolate={interpolateTemplateTokens}
          t={t}
        />
      </div>
    );
  };

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: size.width,
        height: size.height,
        background: printTokens.paper,
        boxShadow: showBoundary ? "0 2px 20px rgba(0,0,0,0.15)" : "none",
        border: showBoundary ? `1px solid ${printTokens.border}` : "none",
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: scale !== 1 ? "top left" : undefined,
        overflow: "hidden",
        breakAfter: breakAfter ? "page" : undefined,
        direction: appDir,
      }}
    >
      {template.elements.map(renderElement)}
    </div>
  );
}

export default TemplateDocumentPreview;

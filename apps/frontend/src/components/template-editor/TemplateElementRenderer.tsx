/**
 * @file TemplateElementRenderer.tsx
 * @description Interactive canvas element: position, selection chrome and keyboard
 * affordances wrapped around the shared {@link TemplateElementContent} renderer.
 */

import React from "react";
import type { DocumentTemplate } from "@mms/shared";
import { PRINT_NEUTRAL } from "@/lib/ui/printBrandingTokens";
import { PRINT_COLORS } from "@/lib/ui/printTemplateStyles";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { interpolateTemplateTokens } from "./templateEditorUtils";
import { TemplateElementContent } from "./templateElementContent";
import { resolveElementGeometry, resolveElementText } from "./templateDataResolution";
import { TemplateElementResizeHandles } from "./TemplateElementResizeHandles";
import type { ResizeHandle } from "./useTemplateEditorInteractions";

export interface TemplateElementRendererProps<TPayload = Record<string, unknown>> {
  el: DocumentTemplate<TPayload>["elements"][number];
  isSelected: boolean;
  isPreviewMode: boolean;
  branding: {
    logoUrl?: string | null;
  };
  sampleData?: TPayload;
  /** Whether this element is the single tab stop for the canvas (roving tabindex). */
  isFocusTarget?: boolean;
  /** Briefly true for a just-added element, so it can be highlighted. */
  isNew?: boolean;
  /** Application direction, used as the fallback writing direction for elements. */
  appDir?: "ltr" | "rtl";
  onMouseDownElement: (event: React.MouseEvent, elementId: string) => void;
  onMouseDownResize: (event: React.MouseEvent, elementId: string, handle?: ResizeHandle) => void;
  onDeleteElement: (elementId: string) => void;
  onSelectElement?: (elementId: string) => void;
  t: TranslationFunction;
}

export const TemplateElementRenderer = React.memo(function TemplateElementRenderer<
  TPayload = Record<string, unknown>,
>({
  el,
  isSelected,
  isPreviewMode,
  branding,
  sampleData,
  isFocusTarget = false,
  isNew = false,
  appDir = "ltr",
  onMouseDownElement,
  onMouseDownResize,
  onDeleteElement,
  onSelectElement,
  t,
}: TemplateElementRendererProps<TPayload>) {
  const [logoLoadFailed, setLogoLoadFailed] = React.useState(false);

  React.useEffect(() => {
    setLogoLoadFailed(false);
  }, [branding.logoUrl]);

  const st = el.style || {};
  const data = (sampleData as Record<string, unknown>) || null;
  const geometry = resolveElementGeometry(el, appDir);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isPreviewMode) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectElement?.(el.id);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      onDeleteElement(el.id);
    } else if (
      (e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown") &&
      !isSelected
    ) {
      e.preventDefault();
      e.stopPropagation();
      onSelectElement?.(el.id);
    }
  };

  const textContent =
    el.type === "field" || el.type === "static"
      ? resolveElementText(el, data, isPreviewMode ? "preview" : "edit", interpolateTemplateTokens)
      : "";

  const elementAriaLabel = el.label
    ? textContent && textContent !== el.label
      ? `${el.label} ${textContent} (${el.type})`
      : `${el.label} (${el.type})`
    : textContent
      ? `${textContent} (${el.type})`
      : `${t("templateEditor.element")} ${el.type}`;

  return (
    <div
      dir={geometry.direction}
      role={isPreviewMode ? undefined : "button"}
      tabIndex={isPreviewMode ? -1 : isFocusTarget ? 0 : -1}
      aria-label={elementAriaLabel}
      aria-pressed={isPreviewMode ? undefined : isSelected}
      onMouseDown={(e) => {
        if (!isPreviewMode) onMouseDownElement(e, el.id);
      }}
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h,
        fontSize: st.fontSize || 10,
        fontWeight: st.fontWeight || "normal",
        fontStyle: st.fontStyle || "normal",
        textDecoration: st.textDecoration || "none",
        fontFamily: st.fontFamily || "inherit",
        color: st.color || PRINT_NEUTRAL.text,
        textAlign: geometry.textAlign,
        direction: geometry.direction,
        border: st.borderWidth
          ? `${st.borderWidth}px solid ${st.borderColor || PRINT_COLORS.borderSlate}`
          : "1px dashed transparent",
        borderRadius: st.borderRadius != null ? `${st.borderRadius}px` : undefined,
        backgroundColor: st.backgroundColor || "transparent",
        cursor: isPreviewMode ? "default" : "move",
      }}
      className={`group flex items-center overflow-visible px-1 focus-visible:outline-2 focus-visible:outline-ring ${
        !isPreviewMode && !isSelected ? "hover:border-primary/40" : ""
      } ${isNew ? "ring-2 ring-primary ring-offset-2 ring-offset-white" : ""} ${
        el.h < 14
          ? "before:absolute before:-top-2 before:-bottom-2 before:start-0 before:end-0 before:content-[''] print:before:hidden"
          : ""
      }`}
    >
      <TemplateElementContent
        el={el}
        data={data}
        mode={isPreviewMode ? "preview" : "edit"}
        logoUrl={branding.logoUrl}
        logoFailed={logoLoadFailed}
        onLogoError={() => setLogoLoadFailed(true)}
        geometry={geometry}
        interpolate={interpolateTemplateTokens}
        t={t}
      />

      {isSelected && !isPreviewMode && (
        <TemplateElementResizeHandles
          elementId={el.id}
          w={el.w}
          h={el.h}
          y={el.y}
          onMouseDownResize={onMouseDownResize}
        />
      )}
    </div>
  );
}) as <TPayload>(props: TemplateElementRendererProps<TPayload>) => React.JSX.Element;

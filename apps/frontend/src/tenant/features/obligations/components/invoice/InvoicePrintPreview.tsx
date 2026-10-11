/**
 * InvoicePrintPreview
 * Pure render of the invoice/receipt on a page canvas.
 *
 * Content rendering is delegated to the shared `TemplateElementContent` module — the
 * same one the editor canvas uses. It used to be a second, independent renderer, and
 * the two disagreed: print ignored the editor's RTL auto-detection, truncated nothing
 * while the canvas truncated, built a different QR payload, and had **no table branch
 * at all**, so a table designed in the editor printed as the literal word "Table".
 */
import React from "react";
import {
  getPageDimensions,
  resolveField,
  type InvoiceTemplate,
  type TemplateElement,
  type FieldLookupInfo,
  AVAILABLE_FIELDS,
} from "@/lib/invoiceTemplateStore";
import { type ObligationCollection } from "@/lib/data/obligationsData";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useTranslation } from "@/hooks/useTranslation";
import { getPrintBrandingTokens } from "@/lib/printBrandingTokens";
import { interpolateTemplateTokens } from "@/components/ui/template-editor/templateEditorUtils";
import { TemplateElementContent } from "@/components/ui/template-editor/templateElementContent";
import { resolveElementGeometry } from "@/components/ui/template-editor/templateDataResolution";

export interface InvoicePrintPreviewProps {
  template: InvoiceTemplate;
  collection?: ObligationCollection | null;
  lookups?: FieldLookupInfo;
  selectedId?: string | null;
  onSelect?: ((id: string) => void) | null;
  scale?: number;
  showBoundary?: boolean;
}

/**
 * Resolves every template field for the record into the same flat payload the editor
 * adapter builds, so both renderers read values from one shape.
 */
function buildFieldData(
  collection: ObligationCollection | null | undefined,
  lookups: FieldLookupInfo | undefined,
): Record<string, unknown> | null {
  if (!collection) return null;
  const record: Record<string, unknown> = { ...collection };
  const data: Record<string, unknown> = {};
  for (const item of AVAILABLE_FIELDS) {
    const value = resolveField(item.field, record, lookups as FieldLookupInfo);
    if (value !== undefined && value !== null && value !== "") {
      data[item.field] = value;
    }
  }
  return data;
}

/**
 * InvoicePrintPreview component.
 * @param {InvoicePrintPreviewProps} props
 */
export function InvoicePrintPreview({
  template,
  collection = null,
  lookups = {},
  selectedId = null,
  onSelect = null,
  scale = 1,
  showBoundary = true,
}: InvoicePrintPreviewProps) {
  const branding = useBranding();
  const { t, isRtl } = useTranslation();
  const printTokens = getPrintBrandingTokens();
  const size = getPageDimensions(template.pageSize, template.orientation);
  const appDir = isRtl ? "rtl" : "ltr";

  const data = React.useMemo(() => buildFieldData(collection, lookups), [collection, lookups]);

  /*
   * The verification URL is a print-only concern: it encodes the live receipt number,
   * amount and date, which only exist when a real record is being printed.
   */
  const qrPayload = React.useMemo(() => {
    if (!collection) return null;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/verify/receipt?no=${encodeURIComponent(collection.receipt_no)}&amount=${collection.amount}&date=${collection.received_date}`;
  }, [collection]);

  const renderElement = (templateElement: TemplateElement) => {
    const isSelected = selectedId === templateElement.id;
    const elementStyle = templateElement.style || {};
    const geometry = resolveElementGeometry(
      templateElement,
      appDir,
      data?.[String(templateElement.field ?? "")] as string | undefined,
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
           * an ellipsis — a printed receipt must not silently drop half a value.
           */
          overflow: "visible",
          cursor: onSelect ? "pointer" : "default",
          boxShadow: isSelected ? `0 0 0 2px ${printTokens.primary}` : undefined,
        }}
      >
        <TemplateElementContent
          el={templateElement}
          data={data}
          mode="print"
          logoUrl={branding.logoUrl}
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
      style={{
        position: "relative",
        width: size.width,
        height: size.height,
        background: printTokens.paper,
        boxShadow: showBoundary ? "0 2px 20px rgba(0,0,0,0.15)" : "none",
        border: showBoundary ? `1px solid ${printTokens.border}` : "none",
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        overflow: "hidden",
        /*
         * No hardcoded `fontFamily: 'Inter', 'Amiri'` any more: the element style wins
         * when set, and otherwise the page inherits the app's language-aware stack
         * (including the Urdu/Persian faces, which the print window used to omit).
         */
        direction: appDir,
      }}
    >
      {template.elements.map(renderElement)}
    </div>
  );
}

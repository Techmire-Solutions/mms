/**
 * InvoicePrintPreview
 * Pure render of the invoice/receipt on a page canvas.
 *
 * This module now only resolves the record into the flat payload shape and delegates
 * rendering to the shared `TemplateDocumentPreview` — the same element renderer every
 * module print path uses. Historically it was a second, independent renderer and the
 * two disagreed (RTL, truncation, QR payload, and tables printed as the word "Table").
 */
import React from "react";
import type { DocumentTemplate } from "@mms/shared";
import {
  resolveField,
  type InvoiceTemplate,
  type FieldLookupInfo,
  AVAILABLE_FIELDS,
} from "@/lib/invoiceTemplateStore";
import { type ObligationCollection } from "@/lib/data/obligationsData";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useTranslation } from "@/hooks/useTranslation";
import { TemplateDocumentPreview } from "@/components/template-editor/TemplateDocumentPreview";

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
}: InvoicePrintPreviewProps): React.JSX.Element {
  const branding = useBranding();
  const { isRtl } = useTranslation();

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

  return (
    <TemplateDocumentPreview<Record<string, unknown>>
      template={template as DocumentTemplate<Record<string, unknown>>}
      data={data}
      logoUrl={branding.logoUrl}
      isRtl={isRtl}
      scale={scale}
      showBoundary={showBoundary}
      qrPayload={qrPayload}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
}

export default InvoicePrintPreview;

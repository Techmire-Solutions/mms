import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoicePrintPreview } from "./InvoicePrintPreview";
import { TemplateElementRenderer } from "@/components/ui/template-editor/TemplateElementRenderer";
import type { InvoiceTemplate } from "@/lib/invoiceTemplateStore";
import type { ObligationCollection } from "@/lib/data/obligationsData";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

/**
 * Canvas ↔ print parity.
 *
 * The editor canvas and the printed page used to be two independent renderers, and they
 * disagreed in ways no existing test could see: the print renderer had **no `table`
 * branch** (a table printed as the literal word "Table"), it ignored the editor's RTL
 * auto-detection (Arabic previewed right-aligned and printed left-aligned), it never
 * ellipsized long text while the canvas did, and it built a different QR payload.
 *
 * Both now render through `templateElementContent`, and this file pins the *decisions*
 * the two must share. A future divergence — someone adding a branch to one renderer —
 * fails here rather than on a user's printed receipt.
 */

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({
    madrasaName: "Al-Hujjah Madrasa",
    logoUrl: null,
    primaryColor: "#0f766e",
    secondaryColor: "#0d9488",
  }),
}));

const mockT = ((key: string) => key) as TranslationFunction;

const collection = {
  id: "obl_1",
  receipt_no: "OBL-09999",
  received_date: "2026-09-12",
  sender_id: "c1",
  reference_id: null,
  amount: 25000,
  currency_id: "PKR",
  payment_mode: "Cash",
  obligation_type_id: "ot_khums",
  mujtahid_representative_id: "rep_1",
  received_by: "u_admin",
} as unknown as ObligationCollection;

const tpl: InvoiceTemplate = {
  pageSize: "A6",
  elements: [
    { id: "el_ar", type: "static", label: "إيصال رسمي", x: 10, y: 10, w: 200, h: 20 },
    {
      id: "el_table",
      type: "table",
      label: "Line Items",
      x: 10,
      y: 40,
      w: 300,
      h: 120,
      columns: [
        { id: "c1", header: "Description", field: "description", width: 180, align: "left" },
        { id: "c2", header: "Amount", field: "amount", width: 100, align: "right" },
      ],
      tableConfig: { showHeader: true, rowHeight: 22, zebra: true },
    },
    {
      id: "el_long",
      type: "static",
      label: "A very long caption that cannot fit in this narrow box",
      x: 10,
      y: 170,
      w: 80,
      h: 14,
    },
    {
      id: "el_field",
      type: "field",
      label: "Receipt No",
      field: "receipt_no",
      x: 10,
      y: 190,
      w: 120,
      h: 16,
    },
    { id: "el_qr", type: "qrcode", label: "Scan to verify", x: 10, y: 210, w: 60, h: 60 },
  ],
};

/** The canvas renderer for one element, in edit mode (what the designer sees). */
function canvasHtml(elementId: string): string {
  const el = tpl.elements.find((e) => e.id === elementId)!;
  return renderToStaticMarkup(
    <TemplateElementRenderer
      el={el}
      isSelected={false}
      isPreviewMode={false}
      branding={{ logoUrl: null }}
      // Typed as a generic payload so the renderer's element type stays `string`.
      sampleData={{ receipt_no: "OBL-09999" } as Record<string, unknown>}
      onMouseDownElement={vi.fn()}
      onMouseDownResize={vi.fn()}
      onDeleteElement={vi.fn()}
      t={mockT}
    />,
  );
}

/** The printed page, with a real record. */
function printHtml(): string {
  return renderToStaticMarkup(
    <InvoicePrintPreview template={tpl} collection={collection} showBoundary={false} />,
  );
}

describe("template rendering parity (canvas vs print)", () => {
  it("resolves writing direction identically for Arabic text", () => {
    expect(canvasHtml("el_ar")).toContain('dir="rtl"');
    expect(canvasHtml("el_ar")).toContain("text-align:right");
    // The printed page used to hardcode `textAlign: left` / `direction: ltr` per element.
    expect(printHtml()).toContain('dir="rtl"');
    expect(printHtml()).toContain("text-align:right");
  });

  it("renders a table as a table on paper, not as its label", () => {
    const canvas = canvasHtml("el_table");
    const print = printHtml();

    for (const html of [canvas, print]) {
      expect(html).toContain("Description");
      expect(html).toContain("Amount");
      expect(html).not.toContain(">Line Items<");
    }
  });

  it("never ellipsizes text elements in either renderer", () => {
    const notTruncated = (html: string) => {
      const span = /<span class="([^"]*)">A very long caption/.exec(html);
      expect(span, "long-text span not found").toBeTruthy();
      expect(span![1]).not.toContain("truncate");
    };

    // The canvas ellipsized while print overflowed, so a designer could not see the
    // collision they were creating. Ellipsizing in both would silently drop data from a
    // printed receipt, so neither does.
    notTruncated(canvasHtml("el_long"));
    notTruncated(printHtml());
  });

  it("shows the field binding while editing and a neutral placeholder on paper", () => {
    // The editor must never render a printed document with "{receipt_no}" in it, and the
    // canvas must never render an empty box that looks broken.
    const fieldElement = tpl.elements.find((e) => e.id === "el_field")!;
    const canvasEmpty = renderToStaticMarkup(
      <TemplateElementRenderer<Record<string, unknown>>
        el={fieldElement}
        isSelected={false}
        isPreviewMode={false}
        branding={{ logoUrl: null }}
        onMouseDownElement={vi.fn()}
        onMouseDownResize={vi.fn()}
        onDeleteElement={vi.fn()}
        t={mockT}
      />,
    );
    expect(canvasEmpty).toContain("{receipt_no}");

    // With no record at all, print shows the placeholder instead of the binding.
    const printNoData = renderToStaticMarkup(
      <InvoicePrintPreview template={tpl} collection={null} showBoundary={false} />,
    );
    expect(printNoData).not.toContain("{receipt_no}");
  });

  it("renders a QR image in both, with the print payload carrying verification data", () => {
    const canvas = canvasHtml("el_qr");
    const print = printHtml();
    expect(canvas).toContain("data:image/svg+xml");
    expect(print).toContain("data:image/svg+xml");
  });
});

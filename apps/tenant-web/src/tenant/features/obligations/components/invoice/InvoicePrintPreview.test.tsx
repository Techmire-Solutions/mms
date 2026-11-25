import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoicePrintPreview } from "./InvoicePrintPreview";
import type { InvoiceTemplate } from "@/lib/invoiceTemplateStore";
import type { ObligationCollection } from "@/lib/data/obligationsData";

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({
    madrasaName: "Al-Hujjah Madrasa",
    logoUrl: "https://example.com/logo.png",
    primaryColor: "#0f766e",
    secondaryColor: "#0d9488",
  }),
}));

const sampleTemplate: InvoiceTemplate = {
  pageSize: "A6",
  elements: [
    {
      id: "el_logo",
      type: "logo",
      label: "Logo",
      x: 10,
      y: 10,
      w: 50,
      h: 50,
    },
    {
      id: "el_static",
      type: "static",
      label: "Official Madrasa Receipt",
      x: 20,
      y: 70,
      w: 200,
      h: 20,
    },
    {
      id: "el_field_receipt",
      type: "field",
      label: "Receipt No",
      field: "receipt_no",
      x: 20,
      y: 100,
      w: 120,
      h: 16,
    },
    {
      id: "el_field_amount",
      type: "field",
      label: "Amount",
      field: "amount",
      x: 20,
      y: 130,
      w: 120,
      h: 20,
    },
    {
      id: "el_divider",
      type: "divider",
      label: "",
      x: 20,
      y: 160,
      w: 300,
      h: 2,
    },
    {
      id: "el_qr",
      type: "qrcode",
      label: "QR Code",
      x: 20,
      y: 170,
      w: 60,
      h: 60,
    },
  ],
};

const sampleCollection: ObligationCollection = {
  id: "obl_1001",
  receipt_no: "OBL-09999",
  received_date: "2026-09-12",
  sender_id: "c_donor_1",
  reference_id: null,
  amount: 25000,
  currency_id: "PKR",
  payment_mode: "Cash",
  obligation_type_id: "ot_khums",
  mujtahid_representative_id: "rep_1",
  received_by: "u_admin",
};

describe("InvoicePrintPreview Component", () => {
  it("renders static text elements correctly", () => {
    const html = renderToStaticMarkup(
      <InvoicePrintPreview
        template={sampleTemplate}
        collection={sampleCollection}
        showBoundary={false}
      />,
    );
    expect(html).toContain("Official Madrasa Receipt");
  });

  it("resolves and renders field values from collection", () => {
    const html = renderToStaticMarkup(
      <InvoicePrintPreview
        template={sampleTemplate}
        collection={sampleCollection}
        lookups={{
          contacts: [{ id: "c_donor_1", name: "Syed Ali Raza" }],
        }}
        showBoundary={false}
      />,
    );
    expect(html).toContain("OBL-09999");
  });

  it("renders QR code verification element with a translated accessible name", () => {
    const html = renderToStaticMarkup(
      <InvoicePrintPreview
        template={sampleTemplate}
        collection={sampleCollection}
        showBoundary={false}
      />,
    );
    // The alt text is translated rather than hardcoded English; the identity `t` of
    // these tests returns the key.
    expect(html).toContain('alt="templateEditor.qrCode"');
    expect(html).toContain("data:image/svg+xml");
  });

  it("prints a table element as a table instead of the literal word 'Table'", () => {
    const tableTemplate: InvoiceTemplate = {
      pageSize: "A6",
      elements: [
        {
          id: "el_table",
          type: "table",
          label: "Line Items",
          x: 10,
          y: 10,
          w: 300,
          h: 120,
          columns: [
            { id: "c1", header: "Description", field: "description", width: 180, align: "left" },
            { id: "c2", header: "Amount", field: "amount", width: 100, align: "right" },
          ],
          tableConfig: { showHeader: true, rowHeight: 22, zebra: true },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <InvoicePrintPreview
        template={tableTemplate}
        collection={sampleCollection}
        showBoundary={false}
      />,
    );

    // Regression guard: the print renderer had no `table` branch at all, so a table
    // designed in the editor printed as its label text.
    expect(html).toContain("Description");
    expect(html).toContain("Amount");
    expect(html).not.toContain(">Line Items<");
  });

  it("never invents line items on a printed document", () => {
    const tableTemplate: InvoiceTemplate = {
      pageSize: "A6",
      elements: [
        {
          id: "el_table",
          type: "table",
          label: "Line Items",
          x: 10,
          y: 10,
          w: 300,
          h: 120,
          columns: [
            { id: "c1", header: "Description", field: "description", width: 200, align: "left" },
          ],
          tableConfig: { showHeader: true, rowHeight: 22 },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <InvoicePrintPreview
        template={tableTemplate}
        collection={sampleCollection}
        showBoundary={false}
      />,
    );

    // The editor shows fee-module placeholder rows so a designer can see the layout;
    // a printed receipt must not contain fabricated "Tuition / Fee Item 1" lines.
    expect(html).not.toContain("Tuition / Fee Item 1");
  });

  it("resolves direction from the app locale instead of hardcoding ltr", () => {
    const arabicTemplate: InvoiceTemplate = {
      pageSize: "A6",
      elements: [{ id: "el_ar", type: "static", label: "إيصال رسمي", x: 10, y: 10, w: 200, h: 20 }],
    };

    const html = renderToStaticMarkup(
      <InvoicePrintPreview template={arabicTemplate} collection={null} showBoundary={false} />,
    );

    // Arabic script auto-detects RTL in the shared renderer, so the printed receipt
    // matches what the editor canvas shows.
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("text-align:right");
  });

  it("renders text elements with visible overflow to avoid clipping", () => {
    const html = renderToStaticMarkup(
      <InvoicePrintPreview
        template={sampleTemplate}
        collection={sampleCollection}
        showBoundary={false}
      />,
    );
    expect(html).toContain("overflow:visible");
  });
});

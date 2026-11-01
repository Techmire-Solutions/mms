import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DocumentTemplate } from "@mms/shared";
import { TemplateDocumentPreview } from "./TemplateDocumentPreview";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const template: DocumentTemplate = {
  pageSize: "A6",
  orientation: "portrait",
  elements: [
    { id: "title", type: "static", label: "INVOICE TITLE", x: 10, y: 10, w: 200, h: 20 },
    {
      id: "student",
      type: "field",
      field: "studentName",
      label: "Student",
      x: 10,
      y: 40,
      w: 200,
      h: 20,
    },
    {
      id: "empty",
      type: "field",
      field: "missingField",
      label: "Missing",
      x: 10,
      y: 70,
      w: 200,
      h: 20,
    },
    {
      id: "rows",
      type: "table",
      label: "Items",
      x: 10,
      y: 100,
      w: 300,
      h: 120,
      columns: [{ header: "Description", field: "description" }],
    },
    { id: "arabic", type: "static", label: "سند قبض", x: 10, y: 240, w: 200, h: 20 },
  ],
};

describe("TemplateDocumentPreview", () => {
  it("renders payload-bound fields, static text, and table rows", () => {
    const html = renderToStaticMarkup(
      <TemplateDocumentPreview
        template={template}
        data={{
          studentName: "Zaid Khan",
          feeItems: [{ description: "Tuition Fee" }],
        }}
        showBoundary={false}
      />,
    );

    expect(html).toContain("INVOICE TITLE");
    expect(html).toContain("Zaid Khan");
    expect(html).toContain("Tuition Fee");
  });

  it("prints an empty bound field as empty, never as a {binding} placeholder", () => {
    const html = renderToStaticMarkup(
      <TemplateDocumentPreview template={template} data={{ studentName: "Zaid Khan" }} />,
    );

    expect(html).not.toContain("{missingField}");
  });

  it("auto-detects RTL text in the element direction", () => {
    const html = renderToStaticMarkup(<TemplateDocumentPreview template={template} data={{}} />);

    expect(html).toContain('dir="rtl"');
  });

  it("adds a page break only when requested", () => {
    const withBreak = renderToStaticMarkup(
      <TemplateDocumentPreview template={template} data={{}} breakAfter />,
    );
    const withoutBreak = renderToStaticMarkup(
      <TemplateDocumentPreview template={template} data={{}} />,
    );

    expect(withBreak).toContain("break-after:page");
    expect(withoutBreak).not.toContain("break-after:");
  });
});

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { TemplateElement } from "@mms/shared";
import { resolveTableRows } from "./templateDataResolution";
import { TemplateElementContent } from "./templateElementContent";
import { generateQrSvgUri } from "@/lib/qrCodeGenerator";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

vi.mock("@/lib/qrCodeGenerator", () => ({
  generateQrSvgUri: vi.fn(() => "data:image/svg+xml,mock"),
}));

const t = ((key: string) => key) as unknown as TranslationFunction;
const interpolate = (text: string) => text;

function tableElement(field?: string): TemplateElement {
  return { id: "t", type: "table", label: "Items", x: 0, y: 0, w: 200, h: 100, field };
}

describe("resolveTableRows", () => {
  const data = {
    lines: [{ account: "Tuition" }],
    taxes: [{ name: "GST" }],
  };

  it("binds to the element's own field when it names an array", () => {
    expect(resolveTableRows(tableElement("taxes"), data)).toEqual([{ name: "GST" }]);
  });

  it("falls back to the first array for legacy tables without a binding", () => {
    expect(resolveTableRows(tableElement(), data)).toEqual([{ account: "Tuition" }]);
  });

  it("returns null when the payload has no rows", () => {
    expect(resolveTableRows(tableElement(), { lines: [] })).toBeNull();
  });
});

describe("QR element content", () => {
  it("encodes a document placeholder, never the logo asset", () => {
    const html = renderToStaticMarkup(
      <TemplateElementContent
        el={{ id: "q", type: "qrcode", label: "", x: 0, y: 0, w: 50, h: 50 }}
        data={null}
        mode="edit"
        logoUrl="data:image/png;base64,AAA"
        geometry={{ direction: "ltr", textAlign: "left" }}
        interpolate={interpolate}
        t={t}
      />,
    );

    expect(html).toContain("data:image/svg+xml,mock");
    expect(generateQrSvgUri).toHaveBeenCalledWith("MMS-DOC", undefined);
  });
});

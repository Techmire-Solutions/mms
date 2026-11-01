import { describe, expect, it, vi } from "vitest";
import type { DocumentTemplate } from "@mms/shared";
import { buildTemplatePrintHtml, printTemplateDocument } from "./templateDocumentPrint";

const a4: DocumentTemplate = { pageSize: "A4", orientation: "portrait", elements: [] };

describe("buildTemplatePrintHtml", () => {
  it("uses the template's paper size, orientation and writing direction", () => {
    const html = buildTemplatePrintHtml({
      template: a4,
      windowTitle: "Report Card",
      language: "ar",
      isRtl: true,
      bodyContent: "<div>PAGE</div>",
    });

    expect(html).toContain("@page { size: 794px 1123px portrait; margin: 0; }");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("<div>PAGE</div>");
  });

  it("uses landscape dimensions for a landscape template", () => {
    const html = buildTemplatePrintHtml({
      template: { pageSize: "A5", orientation: "landscape" },
      windowTitle: "Receipt",
      language: "en",
      isRtl: false,
      bodyContent: "",
    });

    expect(html).toContain("@page { size: 794px 559px landscape; margin: 0; }");
  });
});

describe("printTemplateDocument", () => {
  function fakeWindow() {
    return {
      opener: null as unknown,
      document: { write: vi.fn(), close: vi.fn() },
      addEventListener: vi.fn(),
      focus: vi.fn(),
      print: vi.fn(),
    };
  }

  it("writes the rendered page into a popup sized to the template", () => {
    const win = fakeWindow();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    const preview = document.createElement("div");
    preview.innerHTML = '<div data-testid="page">PAGE</div>';

    const printed = printTemplateDocument({
      previewElement: preview,
      template: a4,
      windowTitle: "Report Card",
      language: "en",
      isRtl: false,
    });

    expect(printed).toBe(true);
    expect(openSpy).toHaveBeenCalledWith("", "_blank", "width=874,height=1243");
    expect(win.document.write).toHaveBeenCalledWith(expect.stringContaining("PAGE"));
    expect(win.document.close).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();
  });

  it("returns false without writing when the popup is blocked", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const preview = document.createElement("div");

    expect(
      printTemplateDocument({
        previewElement: preview,
        template: a4,
        windowTitle: "Report Card",
        language: "en",
        isRtl: false,
      }),
    ).toBe(false);
    openSpy.mockRestore();
  });
});

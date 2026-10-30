import { describe, expect, it } from "vitest";
import {
  PAPER_PRINT_STYLES,
  buildPaperPrintHtml,
} from "@/tenant/features/question-bank/lib/paperBuilderUtils";

function previewWith(html: string): HTMLElement {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element;
}

describe("buildPaperPrintHtml", () => {
  it("escapes a user-authored paper title", () => {
    const html = buildPaperPrintHtml(
      previewWith("<p>Q1</p>"),
      '</title><script>alert("xss")</script>',
    );

    expect(html).toContain("&lt;/title&gt;&lt;script&gt;");
    expect(html).not.toContain("</title><script>");
  });

  it("carries the preview markup and the paper stylesheet", () => {
    const html = buildPaperPrintHtml(previewWith('<p class="q">Q1</p>'), "Midterm");

    expect(html).toContain('<p class="q">Q1</p>');
    expect(html).toContain(PAPER_PRINT_STYLES);
  });

  it("emits no inline script that the app CSP would block", () => {
    const html = buildPaperPrintHtml(previewWith("<p>Q1</p>"), "Midterm");

    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain("window.print");
  });
});

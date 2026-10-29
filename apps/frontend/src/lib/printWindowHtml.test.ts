import { describe, expect, it } from "vitest";
import { buildPrintWindowHtml } from "@/lib/printWindowHtml";

const base = {
  language: "en",
  width: 800,
  height: 600,
  bodyContent: "<p>body</p>",
};

describe("buildPrintWindowHtml", () => {
  it("escapes a user-authored window title instead of parsing it as markup", () => {
    const html = buildPrintWindowHtml({
      ...base,
      windowTitle: '</title><script>alert("xss")</script>',
    });

    expect(html).toContain(
      "<title>&lt;/title&gt;&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</title>",
    );
    expect(html).not.toContain("<title></title>");
  });

  it("keeps the app-generated body fragment untouched", () => {
    const html = buildPrintWindowHtml({
      ...base,
      windowTitle: "Receipt",
      bodyContent: '<div class="receipt"><b>Paid</b></div>',
    });

    expect(html).toContain('<div class="receipt"><b>Paid</b></div>');
  });
});

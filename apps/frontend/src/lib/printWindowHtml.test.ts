import { describe, expect, it, vi } from "vitest";
import { autoPrintWindow, buildPrintWindowHtml } from "@/lib/printWindowHtml";

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

  it("returns markup without an inline script, which the app CSP would block", () => {
    const html = buildPrintWindowHtml({ ...base, windowTitle: "Receipt" });

    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain("window.print");
  });
});

function stubPrintWindow(fonts: Promise<void> | null = Promise.resolve()) {
  const print = vi.fn();
  const close = vi.fn();
  const focus = vi.fn();
  const listeners = new Map<string, EventListener>();
  const win = {
    document: fonts === null ? {} : { fonts: { ready: fonts } },
    print,
    close,
    focus,
    addEventListener: (type: string, listener: EventListener) => {
      listeners.set(type, listener);
    },
  };
  return { win: win as unknown as Window, print, close, focus, listeners };
}

/** Lets the queued fonts.ready handler run. */
async function flushFonts(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("autoPrintWindow", () => {
  it("prints once fonts settle and closes the window when printing finishes", async () => {
    const { win, print, close, listeners } = stubPrintWindow();

    autoPrintWindow(win);
    await flushFonts();

    expect(print).toHaveBeenCalledTimes(1);
    listeners.get("afterprint")?.(new Event("afterprint"));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("prints immediately when the document exposes no font set", () => {
    const { win, print } = stubPrintWindow(null);

    autoPrintWindow(win);

    expect(print).toHaveBeenCalledTimes(1);
  });

  it("still prints when font loading rejects", async () => {
    const { win, print } = stubPrintWindow(Promise.reject(new Error("font load failed")));

    autoPrintWindow(win);
    await flushFonts();

    expect(print).toHaveBeenCalledTimes(1);
  });
});

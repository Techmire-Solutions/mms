import { afterEach, describe, expect, it, vi } from "vitest";
import { printHtmlDocument } from "@/lib/ui/printHtmlDocument";

function stubPrintWindow() {
  const write = vi.fn();
  const fakeWindow = {
    document: {
      write,
      close: vi.fn(),
      fonts: { ready: Promise.resolve() },
    },
    focus: vi.fn(),
    print: vi.fn(),
    close: vi.fn(),
  };
  vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
  return { write, fakeWindow };
}

describe("printHtmlDocument", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("escapes a user-authored title before writing it into the print document", () => {
    const { write } = stubPrintWindow();

    printHtmlDocument('<img src=x onerror="alert(1)">', "<p>certificate</p>");

    expect(write).toHaveBeenCalledTimes(1);
    const html = String(write.mock.calls[0]?.[0]);
    expect(html).toContain("<title>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</title>");
    expect(html).not.toContain("<img src=x");
  });

  it("does nothing when the popup is blocked", () => {
    vi.spyOn(window, "open").mockReturnValue(null);

    expect(() => printHtmlDocument("Title", "<p>certificate</p>")).not.toThrow();
  });
});

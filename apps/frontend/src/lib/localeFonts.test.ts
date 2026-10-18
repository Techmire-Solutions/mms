import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { ensureLocaleFontsLoaded } from "@/lib/localeFonts";

describe("ensureLocaleFontsLoaded", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("does nothing for English", () => {
    ensureLocaleFontsLoaded("en");
    expect(document.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(0);
  });

  it("appends a stylesheet link for a supported RTL locale", () => {
    ensureLocaleFontsLoaded("ar");
    const links = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
    expect(links).toHaveLength(1);
    expect(links[0].href).toContain("fonts.googleapis.com");
  });

  it("does not duplicate a stylesheet for the same locale", () => {
    ensureLocaleFontsLoaded("ur");
    ensureLocaleFontsLoaded("ur");
    expect(document.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(1);
  });
});

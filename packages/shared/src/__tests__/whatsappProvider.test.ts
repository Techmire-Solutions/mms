import { describe, expect, it } from "vitest";
import { PuppeteerWhatsAppProvider } from "../whatsappProvider.js";
import { hasWhatsApp } from "../utils.js";

describe("PuppeteerWhatsAppProvider.getNumberId", () => {
  it("returns digits for international numbers", () => {
    expect(PuppeteerWhatsAppProvider.getNumberId("+92 300 1234567")).toBe("923001234567");
  });

  it("returns null for empty or too-short values", () => {
    expect(PuppeteerWhatsAppProvider.getNumberId("")).toBeNull();
    expect(PuppeteerWhatsAppProvider.getNumberId("123")).toBeNull();
    expect(PuppeteerWhatsAppProvider.getNumberId(null)).toBeNull();
  });
});

describe("hasWhatsApp", () => {
  it("delegates to getNumberId on primary phone", () => {
    expect(
      hasWhatsApp({ phones: [{ label: "mobile", number: "+923001234567", isPrimary: true }] }),
    ).toBe(true);
    expect(hasWhatsApp({ phones: [{ label: "mobile", number: "12", isPrimary: true }] })).toBe(
      false,
    );
    expect(hasWhatsApp({})).toBe(false);
  });
});

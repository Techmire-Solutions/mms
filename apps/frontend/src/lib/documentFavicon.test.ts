import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  PLATFORM_FAVICON_HREF,
  PLATFORM_APPLE_TOUCH_ICON_HREF,
  applyPlatformDocumentFavicon,
  applyTenantDocumentFavicon,
  buildInitialsFaviconDataUrl,
  setDocumentFavicon,
  setDocumentAppleTouchIcon,
} from "@/lib/documentFavicon";

describe("documentFavicon", () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    `;
  });

  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("buildInitialsFaviconDataUrl encodes initials and includes contrast border", () => {
    const href = buildInitialsFaviconDataUrl("Al-Noor Madrasa", "#0f766e");
    expect(href.startsWith("data:image/svg+xml,")).toBe(true);
    const decoded = decodeURIComponent(href);
    expect(decoded).toMatch(/>[A-Z]{1,2}</);
    expect(decoded).toContain("stroke:rgba(255,255,255,0.25)");
  });

  it("applyPlatformDocumentFavicon restores platform icon and touch icon", () => {
    applyPlatformDocumentFavicon();
    const iconLinks = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"));
    for (const link of iconLinks) {
      expect(link.getAttribute("href")).toBe(PLATFORM_FAVICON_HREF);
    }
    const touchLink = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    expect(touchLink?.getAttribute("href")).toBe(PLATFORM_APPLE_TOUCH_ICON_HREF);
  });

  it("applyTenantDocumentFavicon never leaves platform favicon", () => {
    applyTenantDocumentFavicon({});
    const iconLinks = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"));
    for (const link of iconLinks) {
      expect(link.getAttribute("href")).not.toBe(PLATFORM_FAVICON_HREF);
      expect(link.getAttribute("href")?.startsWith("data:")).toBe(true);
    }
  });

  it("applyTenantDocumentFavicon prefers custom favicon over logo", () => {
    applyTenantDocumentFavicon({
      faviconUrl: "https://cdn.example/favicon.png",
      logoUrl: "https://cdn.example/logo.png",
      madrasaName: "Demo",
    });
    const iconLinks = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"));
    for (const link of iconLinks) {
      expect(link.getAttribute("href")).toBe("https://cdn.example/favicon.png");
    }
    const touchLink = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    expect(touchLink?.getAttribute("href")).toBe("https://cdn.example/favicon.png");
  });

  it("applyTenantDocumentFavicon auto-falls back to logo when favicon is missing", () => {
    applyTenantDocumentFavicon({
      logoUrl: "https://cdn.example/logo.png",
      madrasaName: "Demo",
    });
    const iconLinks = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"));
    for (const link of iconLinks) {
      expect(link.getAttribute("href")).toBe("https://cdn.example/logo.png");
    }
    const touchLink = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    expect(touchLink?.getAttribute("href")).toBe("https://cdn.example/logo.png");
  });

  it("setDocumentFavicon creates link when missing", () => {
    document.head.innerHTML = "";
    setDocumentFavicon("https://cdn.example/icon.png");
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    expect(link?.getAttribute("href")).toBe("https://cdn.example/icon.png");
  });

  it("setDocumentAppleTouchIcon creates link when missing", () => {
    document.head.innerHTML = "";
    setDocumentAppleTouchIcon("https://cdn.example/touch.png");
    const link = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    expect(link?.getAttribute("href")).toBe("https://cdn.example/touch.png");
  });
});

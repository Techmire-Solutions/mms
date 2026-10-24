import { getInitials } from "@mms/shared";

export const PLATFORM_FAVICON_HREF = "/favicon.svg";
export const PLATFORM_APPLE_TOUCH_ICON_HREF = "/apple-touch-icon.png";

/** Transparent placeholder so browsers do not fall back to requesting `/favicon.svg`. */
const EMPTY_FAVICON_HREF =
  "data:image/svg+xml," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"></svg>');

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Builds a modern, high-contrast initials favicon & touch icon for tenants without a custom picture.
 * Optimized with:
 * - 85% safe margin & 1px translucent contrast border for light/dark tab legibility
 * - Crisp centered typography
 */
export function buildInitialsFaviconDataUrl(name: string, primaryColor = "#0f766e"): string {
  const initials = (getInitials(name) || "M").slice(0, 2);
  const fill = /^#[0-9a-fA-F]{3,8}$/.test(primaryColor.trim()) ? primaryColor.trim() : "#0f766e";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><style>.bg{fill:${fill};stroke:rgba(255,255,255,0.25);stroke-width:1px;}.txt{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;font-weight:800;fill:#ffffff;text-anchor:middle;dominant-baseline:central;}</style><rect class="bg" x="1.5" y="1.5" width="29" height="29" rx="7"/><text class="txt" x="16" y="16.5">${escapeXml(initials)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function ensureIconLinks(): HTMLLinkElement[] {
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"));
  if (links.length === 0) {
    const link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
    return [link];
  }
  return links;
}

function ensureAppleTouchIconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "apple-touch-icon";
    document.head.appendChild(link);
  }
  return link;
}

/** Sets the browser tab icon. Pass `null` to clear any platform/default icon. */
export function setDocumentFavicon(href: string | null): void {
  if (typeof document === "undefined") return;
  const links = ensureIconLinks();
  const next = href?.trim() || EMPTY_FAVICON_HREF;
  for (const link of links) {
    if (link.getAttribute("href") === next) continue;
    link.type =
      next.startsWith("data:image/svg+xml") || next.endsWith(".svg") ? "image/svg+xml" : "";
    link.href = next;
  }
}

/** Sets the mobile Apple Touch icon. Pass `null` to reset. */
export function setDocumentAppleTouchIcon(href: string | null): void {
  if (typeof document === "undefined") return;
  const link = ensureAppleTouchIconLink();
  const next = href?.trim() || PLATFORM_APPLE_TOUCH_ICON_HREF;
  if (link.getAttribute("href") === next) return;
  link.href = next;
}

/** Platform apex — MMS product favicon & touch icon. */
export function applyPlatformDocumentFavicon(): void {
  setDocumentFavicon(PLATFORM_FAVICON_HREF);
  setDocumentAppleTouchIcon(PLATFORM_APPLE_TOUCH_ICON_HREF);
}

export interface TenantFaviconInput {
  faviconUrl?: string | null;
  logoUrl?: string | null;
  madrasaName?: string | null;
  primaryColor?: string | null;
}

/**
 * Automatically applies tenant tab icon and apple-touch-icon:
 * Custom Favicon → Custom Logo → Auto Initials Crest.
 * Never leaves the default platform icon on a tenant host.
 */
export function applyTenantDocumentFavicon(input: TenantFaviconInput): void {
  const custom = (input.faviconUrl || input.logoUrl || "").trim();
  if (custom) {
    setDocumentFavicon(custom);
    setDocumentAppleTouchIcon(custom);
    return;
  }
  const name = input.madrasaName?.trim();
  if (name) {
    const initialsUrl = buildInitialsFaviconDataUrl(name, input.primaryColor || undefined);
    setDocumentFavicon(initialsUrl);
    setDocumentAppleTouchIcon(initialsUrl);
    return;
  }
  setDocumentFavicon(null);
  setDocumentAppleTouchIcon(null);
}

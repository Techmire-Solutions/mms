import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BRANDING_SETTINGS, resolveBrandingCornerRadius } from "@mms/shared";
import { Badge } from "@shared/ui";
import { PersonIdentityMeta } from "@/components/app/PersonIdentityMeta";
import { DirectoryCardsSelectAllBar } from "@/components/app/DirectoryCardsSelectAllBar";
import { applyBrandingTheme } from "@/lib/brandingTheme";
import { applyDocumentTheme } from "@/lib/brandingThemeCore";
import {
  previewBrandingSettings,
  previewGlobalSettings,
  revertSettingsPreviews,
  SETTINGS_PREVIEW_EVENT,
} from "@/lib/settingsPreview";
import { clearAllPreviews } from "@/lib/settingsPreviewStore";
import { chartTooltipStyle } from "@/components/app/ChartGrid";

vi.mock("@/lib/localeFonts", () => ({ ensureLocaleFontsLoaded: vi.fn() }));

describe("Centralised Theme Enforcement", () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllPreviews();
    document.documentElement.removeAttribute("style");
    document.documentElement.classList.remove("dark");
    document.documentElement.removeAttribute("data-theme");
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...window.location,
        hostname: "demo.mms.local",
        pathname: "/dashboard",
      },
    });
  });

  afterEach(() => {
    clearAllPreviews();
    document.documentElement.removeAttribute("style");
    document.documentElement.classList.remove("dark");
    document.documentElement.removeAttribute("data-theme");
    vi.restoreAllMocks();
  });

  it("applies primary and secondary brand colors to CSS variables", () => {
    applyBrandingTheme({
      primaryColor: "#059669",
      secondaryColor: "#d97706",
      cornerStyle: "rounded",
    });

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--primary")).toMatch(/\d+/);
    expect(root.style.getPropertyValue("--primary-foreground")).toMatch(/\d+/);
    expect(root.style.getPropertyValue("--secondary")).toMatch(/\d+/);
    expect(root.style.getPropertyValue("--secondary-foreground")).toMatch(/\d+/);
    expect(root.style.getPropertyValue("--accent")).toBe(
      root.style.getPropertyValue("--secondary"),
    );
    expect(root.style.getPropertyValue("--ring")).toBe(root.style.getPropertyValue("--primary"));
    expect(root.style.getPropertyValue("--chart-1")).toBe(root.style.getPropertyValue("--primary"));
    expect(root.style.getPropertyValue("--chart-2")).toBe(
      root.style.getPropertyValue("--secondary"),
    );
  });

  it("dynamically updates --radius for each corner style preset", () => {
    const presets = ["sharp", "subtle", "rounded", "soft"] as const;

    for (const preset of presets) {
      applyBrandingTheme({ cornerStyle: preset });
      const expectedRadius = resolveBrandingCornerRadius(preset);
      expect(document.documentElement.style.getPropertyValue("--radius")).toBe(expectedRadius);
    }
  });

  it("switches light and dark display modes correctly", () => {
    applyDocumentTheme(DEFAULT_BRANDING_SETTINGS, "dark", "en");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    applyDocumentTheme(DEFAULT_BRANDING_SETTINGS, "light", "en");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("updates live preview without page refresh on settings draft change", () => {
    const previewListener = vi.fn();
    window.addEventListener(SETTINGS_PREVIEW_EVENT, previewListener);

    // Live preview corner radius
    previewBrandingSettings({ cornerStyle: "soft" });
    expect(previewListener).toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue("--radius")).toBe("1rem");

    // Live preview primary and secondary colors
    previewBrandingSettings({ primaryColor: "#4f46e5", secondaryColor: "#ec4899" });
    expect(document.documentElement.style.getPropertyValue("--primary")).toMatch(/\d+/);
    expect(document.documentElement.style.getPropertyValue("--secondary")).toMatch(/\d+/);

    // Live preview theme mode
    previewGlobalSettings({ theme: "dark" });
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // Revert previews
    revertSettingsPreviews();
    window.removeEventListener(SETTINGS_PREVIEW_EVENT, previewListener);
  });

  it("chartTooltipStyle produces theme-compliant styles using CSS variables", () => {
    const style = chartTooltipStyle();
    expect(style.backgroundColor).toBe("hsl(var(--card))");
    expect(style.borderColor).toBe("hsl(var(--border))");
    expect(style.borderRadius).toBe("var(--radius)");
    expect(style.color).toBe("hsl(var(--card-foreground))");
  });

  it("ensures loading overlays use OVERLAY_BACKDROP semantic classes", async () => {
    const { ModuleOverlayLoadingFallback, ModuleDrawerLoadingSkeleton } =
      await import("@/components/app/ModuleOverlayLoadingChrome");
    expect(typeof ModuleOverlayLoadingFallback).toBe("function");
    expect(typeof ModuleDrawerLoadingSkeleton).toBe("function");
  });

  it("verifies zero unstyled Recharts Tooltip tags exist across frontend components", () => {
    const srcDir = path.resolve(__dirname, "..");
    const unstyled: string[] = [];

    function scanDir(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!["node_modules", "dist", "coverage", "__tests__"].includes(entry.name)) {
            scanDir(path.join(dir, entry.name));
          }
        } else if (/\.(tsx|jsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
          const filePath = path.join(dir, entry.name);
          const content = fs.readFileSync(filePath, "utf8");
          if (!content.includes('from "recharts"') && !content.includes("from 'recharts'"))
            continue;

          let idx = 0;
          while ((idx = content.indexOf("<Tooltip", idx)) !== -1) {
            const tagEnd = content.indexOf("/>", idx);
            const closeTag = content.indexOf("</Tooltip>", idx);
            let end = tagEnd;
            if (closeTag !== -1 && (tagEnd === -1 || closeTag < tagEnd)) {
              end = closeTag;
            }
            const tag = content.substring(idx, end !== -1 ? end + 2 : idx + 200);
            if (
              !tag.startsWith("<TooltipContentProps") &&
              !tag.includes("contentStyle") &&
              !tag.includes("content=")
            ) {
              const line = content.substring(0, idx).split("\n").length;
              unstyled.push(`${path.relative(srcDir, filePath)}:${line}`);
            }
            idx += 8;
          }
        }
      }
    }

    scanDir(srcDir);
    expect(unstyled).toEqual([]);
  });

  it("enforces centralized theme radius on Badge and DirectoryCardsSelectAllBar", () => {
    const badgeHtml = renderToStaticMarkup(React.createElement(Badge, { pill: true }, "+58%"));
    expect(badgeHtml).toContain("rounded-md");
    expect(badgeHtml).not.toContain("rounded-full");

    const barHtml = renderToStaticMarkup(
      React.createElement(DirectoryCardsSelectAllBar, {
        checkboxId: "test-id",
        allSelected: false,
        someSelected: false,
        onSelectAll: () => {},
        selectLabel: "Select all",
        deselectLabel: "Deselect all",
        selectedCount: 12,
        selectedCountLabel: "12 SELECTED",
        pageCountLabel: "12 STUDENTS",
      }),
    );
    expect(barHtml).toContain("12 STUDENTS");
    expect(barHtml).toContain("rounded-md");
    expect(barHtml).not.toContain("rounded-full");
  });

  it("enforces centralized theme radius on PersonIdentityMeta (zero rounded-full)", () => {
    const metaHtml = renderToStaticMarkup(
      React.createElement(PersonIdentityMeta, { gender: "male", pill: true }),
    );
    expect(metaHtml).toContain("Male");
    expect(metaHtml).toContain("rounded-md");
    expect(metaHtml).not.toContain("rounded-full");
  });
});

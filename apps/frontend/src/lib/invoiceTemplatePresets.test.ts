import { describe, expect, it } from "vitest";
import {
  buildClassicPreset,
  buildFormalA5Preset,
  buildModernPreset,
  buildThermalPreset,
  getAvailablePresets,
} from "./invoiceTemplatePresets.js";
import { getPageDimensions, type BrandingInfo } from "./invoiceTemplateTypes.js";

const mockBranding: BrandingInfo = {
  madrasaName: "Al-Huda Academy",
  tagline: "Center of Excellence",
  primaryColor: "#059669",
  secondaryColor: "#047857",
  cornerStyle: "default",
  logoUrl: "",
  faviconUrl: "",
  footerText: "",
  phone: "+92 300 1234567",
  email: "info@alhuda.edu",
  website: "",
  legalName: "",
  registrationNumber: "",
  addressLine1: "123 Knowledge Way",
  addressLine2: "",
  city: "Lahore",
  region: "Punjab",
  postalCode: "54000",
  country: "Pakistan",
  socialLinks: [],
};

describe("invoiceTemplatePresets", () => {
  describe("buildClassicPreset", () => {
    it("creates an A6 template with default elements", () => {
      const template = buildClassicPreset(mockBranding);
      expect(template.pageSize).toBe("A6");
      expect(template.elements.length).toBeGreaterThan(5);
      expect(template.elements.some((el) => el.type === "logo")).toBe(true);
      expect(template.elements.some((el) => el.field === "receipt_no")).toBe(true);
      expect(template.elements.some((el) => el.field === "amount")).toBe(true);
    });
  });

  describe("buildThermalPreset", () => {
    it("creates an 80mm thermal receipt template with QR code and amount in words", () => {
      const template = buildThermalPreset(mockBranding);
      expect(template.pageSize).toBe("80mm");
      expect(template.elements.some((el) => el.type === "qrcode")).toBe(true);
      expect(template.elements.some((el) => el.field === "amount_in_words")).toBe(true);
      expect(template.elements.some((el) => el.id === "th_bless")).toBe(true);
    });
  });

  describe("buildFormalA5Preset", () => {
    it("creates an A5 formal certificate template with QR code and signatory line", () => {
      const template = buildFormalA5Preset(mockBranding);
      expect(template.pageSize).toBe("A5");
      expect(template.elements.some((el) => el.type === "qrcode")).toBe(true);
      expect(template.elements.some((el) => el.field === "amount_in_words")).toBe(true);
      expect(template.elements.some((el) => el.id === "fm_sign_box")).toBe(true);
    });
  });

  describe("buildModernPreset", () => {
    it("creates an A6 modern minimalist template with colored top bar and QR code", () => {
      const template = buildModernPreset(mockBranding);
      expect(template.pageSize).toBe("A6");
      expect(template.elements.some((el) => el.id === "md_bar")).toBe(true);
      expect(template.elements.some((el) => el.type === "qrcode")).toBe(true);
      expect(template.elements.some((el) => el.field === "amount_in_words")).toBe(true);
    });
  });

  describe("getAvailablePresets", () => {
    it("returns all four registered presets with valid keys and templates", () => {
      const presets = getAvailablePresets();
      expect(presets).toHaveLength(4);
      const keys = presets.map((p) => p.key);
      expect(keys).toEqual(["classic_a6", "thermal_80mm", "formal_a5", "modern_a6"]);

      for (const preset of presets) {
        expect(preset.template.elements.length).toBeGreaterThan(0);
        expect(["A6", "80mm", "A5"]).toContain(preset.template.pageSize);
        expect(preset.nameKey).toBeTruthy();
      }
    });
  });

  describe("getPageDimensions", () => {
    it("returns portrait dimensions with width <= height by default or with portrait orientation", () => {
      const a4Portrait = getPageDimensions("A4", "portrait");
      expect(a4Portrait.width).toBeLessThan(a4Portrait.height);
      expect(a4Portrait.width).toBe(794);
      expect(a4Portrait.height).toBe(1123);
      expect(a4Portrait.label).toContain("Portrait");

      const defaultA4 = getPageDimensions("A4");
      expect(defaultA4.width).toBe(794);
      expect(defaultA4.height).toBe(1123);
    });

    it("swaps dimensions in landscape orientation with width > height", () => {
      const a4Landscape = getPageDimensions("A4", "landscape");
      expect(a4Landscape.width).toBe(1123);
      expect(a4Landscape.height).toBe(794);
      expect(a4Landscape.label).toContain("Landscape");

      const a6Landscape = getPageDimensions("A6", "landscape");
      expect(a6Landscape.width).toBe(559);
      expect(a6Landscape.height).toBe(397);
    });

    it("falls back to A6 when unknown pageSizeKey is passed", () => {
      const fallbackPortrait = getPageDimensions("nonexistent_size");
      expect(fallbackPortrait.width).toBe(397);
      expect(fallbackPortrait.height).toBe(559);

      const fallbackLandscape = getPageDimensions("nonexistent_size", "landscape");
      expect(fallbackLandscape.width).toBe(559);
      expect(fallbackLandscape.height).toBe(397);
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  documentTemplateSchema,
  elementStyleSchema,
  getPageDimensions,
  isRtlText,
  pageSizeKeySchema,
  templateElementSchema,
  templateOrientationSchema,
  type DocumentTemplate,
} from "./documentTemplateTypes.js";

describe("documentTemplateTypes", () => {
  describe("isRtlText", () => {
    it("returns false for pure English / LTR text and punctuation", () => {
      expect(isRtlText("Invoice #1024")).toBe(false);
      expect(isRtlText("Fee Receipt - Class 5A")).toBe(false);
      expect(isRtlText("12345.67")).toBe(false);
      expect(isRtlText("")).toBe(false);
    });

    it("returns true for Arabic text", () => {
      expect(isRtlText("فاتورة الرسوم الدراسية")).toBe(true);
      expect(isRtlText("مدرسة النور")).toBe(true);
      expect(isRtlText("بسم الله الرحمن الرحيم")).toBe(true);
    });

    it("returns true for Urdu text including Nastaliq specific characters", () => {
      expect(isRtlText("فیس کی رسید")).toBe(true);
      expect(isRtlText("طالب علم کا نام")).toBe(true);
      expect(isRtlText("کراچی، پاکستان")).toBe(true);
    });

    it("returns true for Persian / Farsi text", () => {
      expect(isRtlText("صورتحساب شهریه")).toBe(true);
      expect(isRtlText("کارنامه تحصیلی")).toBe(true);
    });

    it("detects mixed strings containing RTL words", () => {
      expect(isRtlText("Student Name: محمد علی")).toBe(true);
    });
  });

  describe("getPageDimensions", () => {
    it("returns portrait dimensions for standard A4", () => {
      const dim = getPageDimensions("A4", "portrait");
      expect(dim.width).toBe(794);
      expect(dim.height).toBe(1123);
      expect(dim.label).toContain("Portrait");
    });

    it("returns landscape dimensions for standard A4", () => {
      const dim = getPageDimensions("A4", "landscape");
      expect(dim.width).toBe(1123);
      expect(dim.height).toBe(794);
      expect(dim.label).toContain("Landscape");
    });

    it("falls back to A6 for unknown page size keys", () => {
      const dim = getPageDimensions("unknown-size", "portrait");
      expect(dim.width).toBe(397);
      expect(dim.height).toBe(559);
    });
  });

  describe("pageSizeKeySchema and templateOrientationSchema", () => {
    it("validates supported page size keys", () => {
      expect(pageSizeKeySchema.safeParse("A4").success).toBe(true);
      expect(pageSizeKeySchema.safeParse("80mm").success).toBe(true);
      expect(pageSizeKeySchema.safeParse("CR80").success).toBe(true);
      expect(pageSizeKeySchema.safeParse("A3").success).toBe(false);
    });

    it("validates template orientation", () => {
      expect(templateOrientationSchema.safeParse("portrait").success).toBe(true);
      expect(templateOrientationSchema.safeParse("landscape").success).toBe(true);
      expect(templateOrientationSchema.safeParse("square").success).toBe(false);
    });
  });

  describe("elementStyleSchema", () => {
    it("validates compliant element styles", () => {
      const validStyle = {
        fontSize: 14,
        fontWeight: "bold",
        textAlign: "center" as const,
        color: "#0f172a",
        backgroundColor: "#ffffff",
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "#e2e8f0",
      };
      expect(elementStyleSchema.safeParse(validStyle).success).toBe(true);
    });

    it("rejects extra unknown style attributes due to strict validation", () => {
      const invalidStyle = {
        fontSize: 14,
        unknownAttr: "unexpected",
      };
      expect(elementStyleSchema.safeParse(invalidStyle).success).toBe(false);
    });
  });

  describe("templateElementSchema and documentTemplateSchema", () => {
    it("validates individual template elements via templateElementSchema", () => {
      const el = {
        id: "el_1",
        type: "static",
        label: "Label",
        x: 10,
        y: 10,
        w: 100,
        h: 20,
      };
      expect(templateElementSchema.safeParse(el).success).toBe(true);
    });

    it("validates a complete document template with table and styling", () => {
      const sampleTemplate: DocumentTemplate = {
        pageSize: "A4",
        orientation: "portrait",
        elements: [
          {
            id: "el_header",
            type: "heading",
            label: "Header Title",
            x: 20,
            y: 20,
            w: 400,
            h: 40,
            style: {
              fontSize: 18,
              color: "#000000",
              direction: "ltr",
            },
          },
          {
            id: "el_table",
            type: "table",
            label: "Items Table",
            x: 20,
            y: 80,
            w: 500,
            h: 120,
            columns: [
              { header: "#", field: "id", width: 40, align: "center" },
              { header: "Description", field: "description", width: 260, align: "left" },
            ],
            tableConfig: {
              showHeader: true,
              rowHeight: 24,
              zebra: true,
            },
          },
        ],
      };

      const result = documentTemplateSchema.safeParse(sampleTemplate);
      expect(result.success).toBe(true);
    });

    it("accepts dual-sided templates with backElements", () => {
      const dualSidedTemplate = {
        pageSize: "CR80",
        orientation: "landscape" as const,
        elements: [
          {
            id: "front_title",
            type: "heading",
            label: "Front Card",
            x: 10,
            y: 10,
            w: 100,
            h: 20,
          },
        ],
        backElements: [
          {
            id: "back_terms",
            type: "static",
            label: "Card Terms & Conditions",
            x: 10,
            y: 10,
            w: 200,
            h: 50,
          },
        ],
      };

      const result = documentTemplateSchema.safeParse(dualSidedTemplate);
      expect(result.success).toBe(true);
    });

    it("rejects invalid template elements missing essential coordinates", () => {
      const invalidTemplate = {
        pageSize: "A4",
        elements: [
          {
            id: "el_bad",
            type: "static",
            label: "Missing coords",
            // missing x, y, w, h
          },
        ],
      };

      const result = documentTemplateSchema.safeParse(invalidTemplate);
      expect(result.success).toBe(false);
    });
  });
});

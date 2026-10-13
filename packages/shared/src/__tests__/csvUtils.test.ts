import { describe, expect, it } from "vitest";
import { escapeCsvCell, buildCsvContent, buildTenantExportFilename } from "../core/csvUtils.js";

describe("csvUtils", () => {
  describe("escapeCsvCell", () => {
    it("escapes quotes in strings", () => {
      expect(escapeCsvCell('Hello "World"')).toBe('"Hello ""World"""');
    });

    it("neutralizes formula injection characters (=, +, -, @)", () => {
      expect(escapeCsvCell("=SUM(A1:A10)")).toBe('"\'=SUM(A1:A10)"');
      expect(escapeCsvCell("+12345")).toBe('"\'+12345"');
      expect(escapeCsvCell("-CMD")).toBe('"\'-CMD"');
      expect(escapeCsvCell("@ADMIN")).toBe('"\'@ADMIN"');
    });

    it("preserves valid negative numbers and numeric values without formula escaping", () => {
      expect(escapeCsvCell(-42)).toBe('"-42"');
      expect(escapeCsvCell("-42.50")).toBe('"-42.50"');
      expect(escapeCsvCell(100)).toBe('"100"');
    });

    it("handles null and undefined values safely", () => {
      expect(escapeCsvCell(null)).toBe('""');
      expect(escapeCsvCell(undefined)).toBe('""');
    });
  });

  describe("buildCsvContent", () => {
    it("formats multi-row CSV content", () => {
      const rows = [
        ["Name", "Role"],
        ["Alice", "Admin"],
        ["Bob", "Teacher"],
      ];
      const csv = buildCsvContent(rows);
      expect(csv).toBe('"Name","Role"\n"Alice","Admin"\n"Bob","Teacher"');
    });
  });

  describe("buildTenantExportFilename", () => {
    it("prepends sanitized tenant name to base filename", () => {
      expect(buildTenantExportFilename("Al Huda", "contacts.csv")).toBe("Al_Huda_contacts.csv");
      expect(buildTenantExportFilename("TechMire", "contacts.vcf")).toBe("TechMire_contacts.vcf");
    });

    it("strips unsafe filesystem characters from tenant name", () => {
      expect(buildTenantExportFilename("Madrasa/Test:Special?", "contacts.csv")).toBe(
        "MadrasaTestSpecial_contacts.csv",
      );
    });

    it("prevents duplicate prefixing if base filename already starts with tenant name", () => {
      expect(buildTenantExportFilename("Al_Huda", "Al_Huda_contacts.csv")).toBe(
        "Al_Huda_contacts.csv",
      );
      expect(buildTenantExportFilename("al_huda", "Al_Huda_contacts.csv")).toBe(
        "Al_Huda_contacts.csv",
      );
      expect(buildTenantExportFilename("Al-Huda", "al-huda-contacts.csv")).toBe(
        "al-huda-contacts.csv",
      );
    });

    it("falls back to clean base filename if tenant name is missing or empty", () => {
      expect(buildTenantExportFilename(null, "contacts.csv")).toBe("contacts.csv");
      expect(buildTenantExportFilename(undefined, "contacts.csv")).toBe("contacts.csv");
      expect(buildTenantExportFilename("", "contacts.csv")).toBe("contacts.csv");
      expect(buildTenantExportFilename("   ", "contacts.csv")).toBe("contacts.csv");
    });

    it("falls back to export.csv if base filename is empty", () => {
      expect(buildTenantExportFilename("Al_Huda", "")).toBe("Al_Huda_export.csv");
      expect(buildTenantExportFilename("", "")).toBe("export.csv");
    });
  });
});

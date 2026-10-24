import { describe, it, expect } from "vitest";
import { createModuleTransferSchema, isSystemMetadataKey } from "../dataTransfer/index.js";

describe("moduleTransferSchema (SSOT Data Transfer)", () => {
  interface MockEntity {
    id?: string;
    fullName: string;
    age: number;
    isActive: boolean;
    tenantId?: string;
    createdAt?: string;
  }

  const mockSchema = createModuleTransferSchema<MockEntity>({
    moduleId: "test-module",
    entityNounPlural: "test entities",
    fields: [
      // Internal metadata should be stripped automatically by whitelist
      { key: "id", label: "ID" },
      { key: "tenantId", label: "Tenant ID" },
      { key: "createdAt", label: "Created At" },
      // Whitelisted form fields
      {
        key: "fullName",
        label: "Full Name",
        aliases: ["Name", "Student Name", "full_name"],
        required: true,
        sample: "Fatima Zahra",
      },
      {
        key: "age",
        label: "Age",
        sample: 12,
        extract: (e) => String(e.age),
        parse: (raw) => Number(raw),
      },
      {
        key: "isActive",
        label: "Active Status",
        sample: "Yes",
        extract: (e) => (e.isActive ? "Yes" : "No"),
        parse: (raw) => raw.trim().toLowerCase() === "yes",
      },
    ],
  });

  describe("Field Whitelist & System Metadata Filter", () => {
    it("detects system metadata keys accurately", () => {
      expect(isSystemMetadataKey("id")).toBe(true);
      expect(isSystemMetadataKey("_id")).toBe(true);
      expect(isSystemMetadataKey("tenantId")).toBe(true);
      expect(isSystemMetadataKey("tenant_id")).toBe(true);
      expect(isSystemMetadataKey("createdAt")).toBe(true);
      expect(isSystemMetadataKey("created_at")).toBe(true);
      expect(isSystemMetadataKey("updatedAt")).toBe(true);
      expect(isSystemMetadataKey("deletedAt")).toBe(true);
      expect(isSystemMetadataKey("createdBy")).toBe(true);
      expect(isSystemMetadataKey("updatedBy")).toBe(true);
      expect(isSystemMetadataKey("fullName")).toBe(false);
      expect(isSystemMetadataKey("phone")).toBe(false);
    });

    it("strips all internal metadata from export columns and import mappings", () => {
      const exportIds = mockSchema.exportColumns.map((c) => c.id);
      expect(exportIds).not.toContain("id");
      expect(exportIds).not.toContain("tenantId");
      expect(exportIds).not.toContain("createdAt");
      expect(exportIds).toEqual(["fullName", "age", "isActive"]);

      const mappingKeys = mockSchema.importMappings.map((m) => m.key);
      expect(mappingKeys).not.toContain("id");
      expect(mappingKeys).not.toContain("tenantId");
      expect(mappingKeys).toEqual(["fullName", "age", "isActive"]);
    });
  });

  describe("Bidirectional Symmetry & Roundtrip", () => {
    it("ensures exported headers match primary import headers exactly", () => {
      const exportHeaders = mockSchema.exportColumns.map((c) => c.label);
      const importHeaders = mockSchema.importMappings.map((m) => m.header);
      expect(exportHeaders).toEqual(importHeaders);
      expect(exportHeaders).toEqual(["Full Name", "Age", "Active Status"]);
    });

    it("round-trips entities: export to CSV -> import from CSV produces symmetric entity fields", () => {
      const originalEntities: MockEntity[] = [
        { id: "internal-1", tenantId: "t-1", fullName: "Ali Hassan", age: 14, isActive: true },
        {
          id: "internal-2",
          tenantId: "t-1",
          fullName: "Zaynab Bint Ali",
          age: 16,
          isActive: false,
        },
      ];

      // 1. Export to CSV
      const csvOutput = mockSchema.toExportCsv(originalEntities);
      expect(csvOutput).toContain('"Full Name","Age","Active Status"');
      expect(csvOutput).toContain('"Ali Hassan","14","Yes"');
      expect(csvOutput).toContain('"Zaynab Bint Ali","16","No"');
      // Verify no metadata leaked in CSV
      expect(csvOutput).not.toContain("internal-1");
      expect(csvOutput).not.toContain("t-1");

      // 2. Import same CSV text back
      const importResult = mockSchema.fromImportCsv(csvOutput);
      expect(importResult.missingHeaders).toHaveLength(0);
      expect(importResult.rowErrors).toHaveLength(0);
      expect(importResult.rows).toHaveLength(2);
      expect(importResult.rows[0]).toEqual({
        fullName: "Ali Hassan",
        age: 14,
        isActive: true,
      });
      expect(importResult.rows[1]).toEqual({
        fullName: "Zaynab Bint Ali",
        age: 16,
        isActive: false,
      });
    });

    it("accepts configured aliases when importing external files", () => {
      const externalCsv = "Student Name,age,Active Status\nHussain,10,Yes\n";
      const result = mockSchema.fromImportCsv(externalCsv);
      expect(result.missingHeaders).toHaveLength(0);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({
        fullName: "Hussain",
        age: 10,
        isActive: true,
      });
    });

    it("detects missing required fields and surfaces errors", () => {
      const invalidCsv = "Age,Active Status\n10,Yes\n";
      const result = mockSchema.fromImportCsv(invalidCsv);
      expect(result.missingHeaders).toContain("Full Name");
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("Template Generation", () => {
    it("generates a CSV template containing headers and sample data", () => {
      const template = mockSchema.generateTemplate();
      expect(template).toContain('"Full Name","Age","Active Status"');
      expect(template).toContain('"Fatima Zahra","12","Yes"');
    });
  });
});

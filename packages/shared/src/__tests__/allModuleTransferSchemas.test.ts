import { describe, it, expect } from "vitest";
import {
  getAllModuleTransferCoverage,
  getModuleTransferSchema,
  isSystemMetadataKey,
} from "../dataTransfer/index.js";

describe("All Module Transfer Schemas (Monorepo Symmetry & Whitelist)", () => {
  it("provides an implemented, registered schema for every cataloged module", () => {
    const coverage = getAllModuleTransferCoverage();
    expect(coverage).toHaveLength(15);
    for (const record of coverage) {
      expect(record.status).toBe("implemented");
      const schema = getModuleTransferSchema(record.moduleId);
      expect(schema).toBeDefined();
      expect(schema?.moduleId).toBe(record.moduleId);
    }
  });

  it("strictly enforces the Field Whitelist on every module schema", () => {
    const coverage = getAllModuleTransferCoverage();
    for (const record of coverage) {
      const schema = getModuleTransferSchema(record.moduleId);
      expect(schema).toBeDefined();
      if (!schema) continue;

      for (const col of schema.exportColumns) {
        expect(isSystemMetadataKey(col.id)).toBe(false);
        expect(isSystemMetadataKey(col.label)).toBe(false);
      }

      for (const mapping of schema.importMappings) {
        expect(isSystemMetadataKey(mapping.key)).toBe(false);
        expect(isSystemMetadataKey(mapping.header)).toBe(false);
        if (mapping.aliases) {
          for (const alias of mapping.aliases) {
            expect(isSystemMetadataKey(alias)).toBe(false);
          }
        }
      }
    }
  });

  it("guarantees bidirectional 1:1 header symmetry on every module schema", () => {
    const coverage = getAllModuleTransferCoverage();
    for (const record of coverage) {
      const schema = getModuleTransferSchema(record.moduleId);
      expect(schema).toBeDefined();
      if (!schema) continue;

      const exportLabels = schema.exportColumns.map((c) => c.label);
      const importHeaders = schema.importMappings.map((m) => m.header);
      expect(exportLabels).toEqual(importHeaders);
      expect(exportLabels.length).toBeGreaterThan(0);
    }
  });

  it("generates non-empty CSV templates with sample data for every module", () => {
    const coverage = getAllModuleTransferCoverage();
    for (const record of coverage) {
      const schema = getModuleTransferSchema(record.moduleId);
      expect(schema).toBeDefined();
      if (!schema) continue;

      const template = schema.generateTemplate();
      expect(template).toBeTruthy();
      const firstLine = template.split("\n")[0];
      expect(firstLine).toContain(schema.exportColumns[0].label);
    }
  });

  it("performs clean export-to-import roundtrip on studentTransferSchema", async () => {
    const { studentsTransferSchema } = await import("../dataTransfer/index.js");
    const student = {
      name: "Muhammad Baqir",
      grNumber: "GR-2099",
      studentId: "STU-99",
      gender: "male",
      dob: "2012-05-14",
      city: "Karachi",
      phone: "+923001122334",
      email: "baqir@madrasa.org",
      fatherName: "Ali Raza",
      status: "active",
      notes: "Scholar student",
    };

    const csv = studentsTransferSchema.toExportCsv([student]);
    expect(csv).toContain('"Student Name","GR Number"');
    expect(csv).toContain('"Muhammad Baqir","GR-2099"');

    const result = studentsTransferSchema.fromImportCsv(csv);
    expect(result.missingHeaders).toHaveLength(0);
    expect(result.rowErrors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: "Muhammad Baqir",
      grNumber: "GR-2099",
      studentId: "STU-99",
      gender: "male",
      dob: "2012-05-14",
      city: "Karachi",
      phone: "+923001122334",
      email: "baqir@madrasa.org",
      fatherName: "Ali Raza",
      status: "active",
      notes: "Scholar student",
    });
  });

  it("performs clean export-to-import roundtrip on facultyTransferSchema", async () => {
    const { facultyTransferSchema } = await import("../dataTransfer/index.js");
    const faculty = {
      name: "Allama Majlisi",
      employeeId: "EMP-007",
      department: "Hadith Studies",
      designation: "Professor",
      phone: "+923331122334",
      email: "majlisi@madrasa.org",
      status: "active",
    };

    const csv = facultyTransferSchema.toExportCsv([faculty]);
    expect(csv).toContain('"Faculty Name","Employee ID"');
    expect(csv).toContain('"Allama Majlisi","EMP-007"');

    const result = facultyTransferSchema.fromImportCsv(csv);
    expect(result.missingHeaders).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({
      name: "Allama Majlisi",
      employeeId: "EMP-007",
      department: "Hadith Studies",
      designation: "Professor",
      phone: "+923331122334",
      email: "majlisi@madrasa.org",
    });
  });

  it("performs clean export-to-import roundtrip on accountingTransferSchema", async () => {
    const { accountingTransferSchema } = await import("../dataTransfer/index.js");
    const account = {
      code: "1020",
      name: "Petty Cash Najaf",
      type: "asset",
      balance: 15000,
      currency: "PKR",
      status: "active",
    };

    const csv = accountingTransferSchema.toExportCsv([account]);
    expect(csv).toContain('"Account Code","Account Name"');

    const result = accountingTransferSchema.fromImportCsv(csv);
    expect(result.missingHeaders).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({
      code: "1020",
      name: "Petty Cash Najaf",
      type: "asset",
      balance: "15000",
    });
  });

  it("guarantees bidirectional export-to-import roundtrip across all 15 module schemas", () => {
    const coverage = getAllModuleTransferCoverage();
    expect(coverage).toHaveLength(15);
    for (const record of coverage) {
      const schema = getModuleTransferSchema(record.moduleId);
      expect(schema).toBeDefined();
      if (!schema) continue;

      const entity: Record<string, unknown> = {};
      for (const field of schema.fields) {
        entity[field.key] = field.sample !== undefined ? field.sample : "test";
      }

      const csv = schema.toExportCsv([entity]);
      const result = schema.fromImportCsv(csv);

      expect(result.missingHeaders).toHaveLength(0);
      expect(result.rows).toHaveLength(1);
    }
  });
});

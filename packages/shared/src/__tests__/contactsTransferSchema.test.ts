import { describe, it, expect } from "vitest";
import { contactsTransferSchema } from "../contacts/contactsTransferSchema.js";
import type { Contact } from "../contacts/contactEntityTypes.js";

describe("contactsTransferSchema (Symmetric SSOT Example)", () => {
  it("enforces Field Whitelist: strips internal IDs and audit metadata", () => {
    const columnIds = contactsTransferSchema.exportColumns.map((c) => c.id);
    expect(columnIds).not.toContain("id");
    expect(columnIds).not.toContain("createdAt");
    expect(columnIds).not.toContain("updatedAt");
    expect(columnIds).not.toContain("createdBy");
    expect(columnIds).not.toContain("updatedBy");
    expect(columnIds).not.toContain("tenantId");
    expect(columnIds).not.toContain("deletedAt");

    // Only human-readable form fields
    expect(columnIds).toContain("name");
    expect(columnIds).toContain("firstName");
    expect(columnIds).toContain("lastName");
    expect(columnIds).toContain("gender");
    expect(columnIds).toContain("dob");
    expect(columnIds).toContain("cnic");
    expect(columnIds).toContain("isSyed");
    expect(columnIds).toContain("phone");
    expect(columnIds).toContain("email");
    expect(columnIds).toContain("line1");
    expect(columnIds).toContain("city");
    expect(columnIds).toContain("country");
  });

  it("guarantees bidirectional symmetry between export headers and import headers", () => {
    const exportLabels = contactsTransferSchema.exportColumns.map((c) => c.label);
    const importHeaders = contactsTransferSchema.importMappings.map((m) => m.header);

    expect(exportLabels).toEqual(importHeaders);
    expect(exportLabels).toContain("Full Name");
    expect(exportLabels).toContain("Phone Number");
    expect(exportLabels).toContain("Email Address");
    expect(exportLabels).toContain("Street Address");
  });

  it("performs clean export-to-import bidirectional roundtrip", () => {
    const contacts: Contact[] = [
      {
        id: "db-internal-101",
        name: "Sayyid Ammar",
        firstName: "Sayyid",
        lastName: "Ammar",
        gender: "male",
        dob: "1985-03-20",
        cnic: "35201-9988776-5",
        isSyed: true,
        tag: "Teacher",
        notes: "Senior faculty member",
        phones: [{ label: "Mobile", number: "+923009999999", isPrimary: true }],
        emails: [{ label: "Work", address: "ammar@madrasa.org", isPrimary: true }],
        addresses: [{ line1: "45 Knowledge Way", city: "Najaf", country: "Iraq", isPrimary: true }],
      },
    ];

    // 1. Export contacts to CSV
    const csv = contactsTransferSchema.toExportCsv(contacts);
    expect(csv).toContain('"Full Name","First Name","Last Name"');
    expect(csv).toContain('"Sayyid Ammar","Sayyid","Ammar"');
    expect(csv).toContain('"Yes"'); // isSyed
    expect(csv).toContain('"\'+923009999999"');
    expect(csv).toContain('"ammar@madrasa.org"');
    expect(csv).not.toContain("db-internal-101"); // internal ID excluded

    // 2. Import CSV back
    const parsed = contactsTransferSchema.fromImportCsv(csv);
    expect(parsed.missingHeaders).toHaveLength(0);
    expect(parsed.rowErrors).toHaveLength(0);
    expect(parsed.rows).toHaveLength(1);

    const importedRow = parsed.rows[0];
    expect(importedRow).toMatchObject({
      name: "Sayyid Ammar",
      firstName: "Sayyid",
      lastName: "Ammar",
      gender: "male",
      dob: "1985-03-20",
      cnic: "35201-9988776-5",
      isSyed: true,
      phone: "+923009999999",
      email: "ammar@madrasa.org",
      line1: "45 Knowledge Way",
      city: "Najaf",
      country: "Iraq",
      tag: "Teacher",
      notes: "Senior faculty member",
    });
  });

  it("generates a ready-to-use CSV template with sample data", () => {
    const template = contactsTransferSchema.generateTemplate();
    expect(template).toContain('"Full Name","First Name","Last Name"');
    expect(template).toContain('"Zayd ibn Ali"');
    expect(template).toContain('"zayd@example.com"');
  });

  it("is registered in the moduleTransferRegistry with active coverage", async () => {
    const { getModuleTransferSchema, getModuleTransferCoverage, isModuleTransferImplemented } =
      await import("../dataTransfer/index.js");

    expect(isModuleTransferImplemented("contacts")).toBe(true);

    const schema = getModuleTransferSchema("contacts");
    expect(schema).toBeDefined();
    expect(schema?.moduleId).toBe("contacts");

    const coverage = getModuleTransferCoverage("contacts");
    expect(coverage).toBeDefined();
    expect(coverage?.status).toBe("implemented");
    expect(coverage?.formSurfaces).toContain("Identity");
    expect(coverage?.formSurfaces).toContain("Phones");
  });

  it("supports direct 2D grid mapping with mapGrid", () => {
    const grid = [
      ["Full Name", "Phone Number", "Is Syed"],
      ["Ja'far al-Sadiq", "+923001112233", "Yes"],
    ];
    const result = contactsTransferSchema.mapGrid(grid);
    expect(result.missingHeaders).toHaveLength(0);
    expect(result.rowErrors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: "Ja'far al-Sadiq",
      phone: "+923001112233",
      isSyed: true,
    });
  });
});

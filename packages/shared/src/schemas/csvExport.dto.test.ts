import { describe, expect, it } from "vitest";
import { contactsCsvExportBodySchema } from "./csvExport.dto.js";
import { DEFAULT_CONTACT_EXPORT_COLUMNS } from "../contacts/contactExportColumns.js";

describe("csvExport.dto", () => {
  it("accepts DEFAULT_CONTACT_EXPORT_COLUMNS without too_big error", () => {
    expect(DEFAULT_CONTACT_EXPORT_COLUMNS.length).toBeGreaterThan(50);

    const result = contactsCsvExportBodySchema.safeParse({
      label: "Exporting Contacts",
      columns: DEFAULT_CONTACT_EXPORT_COLUMNS,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.columns).toHaveLength(DEFAULT_CONTACT_EXPORT_COLUMNS.length);
    }
  });

  it("rejects columns exceeding the maximum of 200 items", () => {
    const tooMany = Array.from({ length: 201 }, (_, i) => ({
      id: `col_${i}`,
      label: `Column ${i}`,
    }));

    const result = contactsCsvExportBodySchema.safeParse({
      label: "Too Many Columns",
      columns: tooMany,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "columns");
      expect(issue).toBeDefined();
      expect(issue?.code).toBe("too_big");
    }
  });

  it("sanitizes label and filename stripping directional overrides", () => {
    const result = contactsCsvExportBodySchema.safeParse({
      label: "Contacts\u202EExport",
      filename: "contacts.csv",
      columns: [{ id: "name", label: "Full Name" }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.label).toBe("ContactsExport");
      expect(result.data.filename).toBe("contacts.csv");
    }
  });
});

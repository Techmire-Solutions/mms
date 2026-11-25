import { describe, expect, it } from "vitest";
import {
  defaultContactsExportColumns,
  resolveContactsExportColumns,
} from "./useContactsExportActions.js";

describe("contacts export column helpers", () => {
  const fakeT = (key: string) => `translated:${key}`;

  it("defaultContactsExportColumns returns default columns with registry labels", () => {
    const columns = defaultContactsExportColumns();
    expect(columns.length).toBeGreaterThan(0);
    expect(columns[0]).toEqual({
      id: "id",
      label: "Contact ID",
    });
  });

  it("resolveContactsExportColumns maps valid columns and sanitizes labels", () => {
    const input = [
      { id: "name", label: "Full Name" },
      { key: "phone", label: "Mobile" },
      { id: "city", labelKey: "contacts.columns.city" as const },
      { id: "   ", label: "Empty ID" },
      { id: "valid", label: "   " },
    ];

    const result = resolveContactsExportColumns(input, fakeT);
    expect(result).toEqual([
      { id: "name", label: "Full Name" },
      { id: "phone", label: "Mobile" },
      { id: "city", label: "translated:contacts.columns.city" },
      { id: "valid", label: "valid" },
    ]);
  });

  it("resolveContactsExportColumns falls back to defaults when list is empty", () => {
    const result = resolveContactsExportColumns([], fakeT);
    expect(result).toEqual(defaultContactsExportColumns());
  });

  it("resolveContactsExportColumns caps columns at 200", () => {
    const input = Array.from({ length: 250 }, (_, i) => ({
      id: `col_${i}`,
      label: `Col ${i}`,
    }));
    const result = resolveContactsExportColumns(input, fakeT);
    expect(result).toHaveLength(200);
  });

  it("defaultContactsExportColumns merges custom fields when fieldConfig is passed", () => {
    const fieldConfig = {
      version: 1,
      fields: {
        basic: [
          {
            key: "bloodGroup",
            label: "Blood Group",
            type: "text" as const,
            enabled: true,
            order: 8,
            required: false,
          },
        ],
      },
      formTabs: [{ key: "custom_medical", label: "Medical History", enabled: true, order: 10 }],
    };

    const columns = defaultContactsExportColumns(fieldConfig);
    const ids = columns.map((c) => c.id);
    expect(ids).toContain("bloodGroup");
    expect(ids).toContain("custom_medical");
    expect(ids).toContain("solarDob");
    expect(ids).toContain("lunarDob");
  });
});

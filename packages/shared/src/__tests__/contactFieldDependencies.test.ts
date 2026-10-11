import { describe, expect, it } from "vitest";
import {
  getContactFieldRemovalIssues,
  isContactSeedFieldKey,
} from "../contactFieldDependencies.js";
import { DEFAULT_COLUMN_REGISTRY } from "../contactTypes.js";

describe("contactFieldDependencies", () => {
  it("blocks removal of seed fields", () => {
    expect(isContactSeedFieldKey("firstName")).toBe(true);
    const issues = getContactFieldRemovalIssues({
      fieldKey: "firstName",
      columnRegistry: DEFAULT_COLUMN_REGISTRY,
      preferences: { duplicateDetectionFields: [] },
    });
    expect(issues.some((i) => i.area === "systemField")).toBe(true);
  });

  it("blocks removal when field is an enabled column", () => {
    const issues = getContactFieldRemovalIssues({
      fieldKey: "customField",
      columnRegistry: [
        { key: "custom:customField", label: "Custom Field", enabled: true, order: 10 },
      ],
      preferences: { duplicateDetectionFields: [] },
    });
    expect(issues.some((i) => i.area === "column")).toBe(true);
  });

  it("blocks removal when contacts hold custom field data", () => {
    const issues = getContactFieldRemovalIssues({
      fieldKey: "customNotes",
      columnRegistry: [],
      preferences: { duplicateDetectionFields: [] },
      contacts: [{ id: "1", name: "A", customNotes: "hello" } as never],
    });
    expect(issues.some((i) => i.area === "contactData")).toBe(true);
  });
});

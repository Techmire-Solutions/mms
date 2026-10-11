import { describe, expect, it } from "vitest";
import type { AppTranslationKey } from "@mms/shared";
import {
  formatLocalizedRelationshipLabel,
  formatLocalizedRelationshipParts,
} from "@/lib/contacts/formatLocalizedRelationshipLabel";

const DICT: Partial<Record<AppTranslationKey, string>> = {
  "contacts.options.relationship.father": "Père",
  "contacts.options.relationship.mother": "Mère",
  "contacts.options.relationship.sibling": "Frère/Soeur",
};

function t(key: AppTranslationKey): string {
  return DICT[key] ?? key;
}

describe("formatLocalizedRelationshipParts", () => {
  it("returns blank parts for empty relationship", () => {
    expect(formatLocalizedRelationshipParts(undefined, null, t)).toEqual({
      display: "",
      label: "",
    });
    expect(formatLocalizedRelationshipParts("   ", "male", t)).toEqual({ display: "", label: "" });
  });

  it("genders parent by the resolved gender and localizes the label", () => {
    expect(formatLocalizedRelationshipParts("parent", "male", t)).toEqual({
      display: "Father",
      label: "Père",
    });
    expect(formatLocalizedRelationshipParts("parent", "female", t)).toEqual({
      display: "Mother",
      label: "Mère",
    });
  });

  it("falls back to the raw relationship when the label is not localized", () => {
    expect(formatLocalizedRelationshipParts("parent", null, t)).toEqual({
      display: "parent",
      label: "parent",
    });
  });

  it("localizes known option values", () => {
    expect(formatLocalizedRelationshipParts("sibling", null, t).label).toBe("Frère/Soeur");
    expect(formatLocalizedRelationshipParts("custom-relation", null, t).label).toBe(
      "custom-relation",
    );
  });
});

describe("formatLocalizedRelationshipLabel", () => {
  it("returns the localized label for a parent", () => {
    expect(formatLocalizedRelationshipLabel("parent", "male", t)).toBe("Père");
  });

  it("returns blank for missing relationship", () => {
    expect(formatLocalizedRelationshipLabel("", "male", t)).toBe("");
  });
});

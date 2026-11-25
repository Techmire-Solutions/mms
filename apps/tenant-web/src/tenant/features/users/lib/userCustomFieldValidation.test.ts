import { describe, expect, it } from "vitest";
import type { ModuleCustomField } from "@mms/contracts";
import { validateUserCustomFields } from "./userCustomFieldValidation";

const fields: ModuleCustomField[] = [
  { id: "badgeNumber", label: "Badge number", type: "text", required: true },
  { id: "floor", label: "Floor", type: "number" },
  { id: "shift", label: "Shift", type: "select", options: ["Morning", "Evening"] },
  { id: "hidden", label: "Hidden", type: "text", showInForm: false, required: true },
];

describe("validateUserCustomFields", () => {
  it("reports required/type/option errors and ignores non-form fields", () => {
    const errors = validateUserCustomFields(
      fields,
      { badgeNumber: "  ", floor: "nope", shift: "Night", hidden: "" },
      "en",
    );

    expect(errors.badgeNumber).toMatch(/required/i);
    expect(errors.floor).toMatch(/number/i);
    expect(errors.shift).toMatch(/option|valid|select/i);
    expect(errors.hidden).toBeUndefined();
  });

  it("accepts valid values", () => {
    expect(
      validateUserCustomFields(
        fields,
        { badgeNumber: "A-12", floor: "3", shift: "Morning", hidden: "" },
        "en",
      ),
    ).toEqual({});
  });
});

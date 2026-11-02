import { describe, expect, it } from "vitest";
import {
  CONTACT_PICKER_DEFAULT_RESULTS,
  CONTACT_PICKER_MAX_RESULTS,
  contactPickerOptionSchema,
  contactPickerSearchQuerySchema,
} from "../contacts/contactPicker.js";

describe("contactPicker schemas", () => {
  it("publishes the result caps", () => {
    expect(CONTACT_PICKER_MAX_RESULTS).toBe(20);
    expect(CONTACT_PICKER_DEFAULT_RESULTS).toBe(8);
  });

  it("coerces limit and trims the search term", () => {
    const parsed = contactPickerSearchQuerySchema.parse({ limit: "12", search: "  ali  " });
    expect(parsed).toEqual({ limit: 12, search: "ali" });
  });

  it("accepts boolean and string hasPhone flags", () => {
    expect(contactPickerSearchQuerySchema.parse({ hasPhone: true }).hasPhone).toBe(true);
    expect(contactPickerSearchQuerySchema.parse({ hasPhone: "true" }).hasPhone).toBe("true");
    expect(contactPickerSearchQuerySchema.parse({ hasPhone: "false" }).hasPhone).toBe("false");
  });

  it("rejects an out-of-range limit and an invalid hasPhone", () => {
    expect(
      contactPickerSearchQuerySchema.safeParse({ limit: CONTACT_PICKER_MAX_RESULTS + 1 }).success,
    ).toBe(false);
    expect(contactPickerSearchQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(contactPickerSearchQuerySchema.safeParse({ hasPhone: "yes" }).success).toBe(false);
  });

  it("rejects keys outside the picker query", () => {
    expect(contactPickerSearchQuerySchema.safeParse({ includeDeleted: "true" }).success).toBe(
      false,
    );
  });

  it("keeps the option strictly to the lean shape", () => {
    const option = { id: "c1", name: "Ali Khan", phone: "+923001234567", city: "Lahore" };
    expect(contactPickerOptionSchema.parse(option)).toEqual(option);
    expect(contactPickerOptionSchema.safeParse({ ...option, cnic: "123" }).success).toBe(false);
    expect(contactPickerOptionSchema.safeParse({ id: "c1", name: "Ali" }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { AppTranslationKey, Contact } from "@mms/shared";
import {
  buildContactsMap,
  formatContactCellValue,
  formatContactDobWithAge,
  getDuplicateFieldValue,
} from "@/lib/contacts/contactI18nFormat";

const DICT: Partial<Record<AppTranslationKey, string>> = {
  "contacts.table.dobLabel": "DOB",
  "contacts.table.inlineAge": "Age {count}",
  "contacts.table.emptyDash": "—",
  "common.yes": "Yes",
  "common.no": "No",
  "contacts.gender.male": "Male",
  "contacts.gender.female": "Female",
};

function t(key: AppTranslationKey): string {
  return DICT[key] ?? key;
}

describe("formatContactDobWithAge", () => {
  it("returns empty for missing dob", () => {
    expect(formatContactDobWithAge(undefined, t)).toBe("");
    expect(formatContactDobWithAge(null, t)).toBe("");
  });

  it("formats the dob with the inline age suffix", () => {
    const result = formatContactDobWithAge("1990-01-01", t);
    expect(result).toContain("DOB");
    expect(result).toContain("01/01/1990");
    expect(result).toContain("Age");
  });

  it("formats the dob with detailed solar age in parens when requested", () => {
    const result = formatContactDobWithAge("1990-01-01", t, { showDetailedSolarAge: true });
    expect(result).toContain("DOB");
    expect(result).toContain("01/01/1990");
    expect(result).toContain("(");
  });
});

describe("formatContactCellValue", () => {
  it("renders the empty dash for null/undefined/empty string", () => {
    expect(formatContactCellValue(null, t)).toBe("—");
    expect(formatContactCellValue(undefined, t)).toBe("—");
    expect(formatContactCellValue("", t)).toBe("—");
  });

  it("localizes booleans", () => {
    expect(formatContactCellValue(true, t)).toBe("Yes");
    expect(formatContactCellValue(false, t)).toBe("No");
  });

  it("joins arrays and strings objects", () => {
    expect(formatContactCellValue(["a", "b"], t)).toBe("a, b");
    expect(formatContactCellValue(42, t)).toBe("42");
  });

  it("stringifies plain objects", () => {
    expect(formatContactCellValue({ city: "Lahore" }, t)).toBe('{"city":"Lahore"}');
  });
});

describe("getDuplicateFieldValue", () => {
  const dash = () => t("contacts.table.emptyDash");

  it("returns the primary phone", () => {
    const contact = {
      phones: [{ isPrimary: true, number: "3001234567", countryCode: "+92" }],
    } as Contact;
    expect(getDuplicateFieldValue("phone", contact, t)).toBe("+92 3001234567");
  });

  it("falls back to empty dash when no phone", () => {
    expect(getDuplicateFieldValue("phone", {} as Contact, t)).toBe(dash());
  });

  it("returns the primary email or first address", () => {
    const contact = { emails: [{ isPrimary: true, address: "a@b.com" }] } as Contact;
    expect(getDuplicateFieldValue("email", contact, t)).toBe("a@b.com");
    const fallback = { emails: [{ address: "x@y.io" }] } as Contact;
    expect(getDuplicateFieldValue("email", fallback, t)).toBe("x@y.io");
  });

  it("localizes gender and formats dob", () => {
    expect(getDuplicateFieldValue("gender", { gender: "male" } as Contact, t)).toBe("Male");
    expect(getDuplicateFieldValue("dob", { dob: "1990-01-01" } as Contact, t)).toBe("01/01/1990");
  });

  it("reads unknown custom fields directly", () => {
    expect(getDuplicateFieldValue("nickname", { nickname: "Zain" } as unknown as Contact, t)).toBe(
      "Zain",
    );
  });
});

describe("buildContactsMap", () => {
  it("returns null for empty input", () => {
    expect(buildContactsMap()).toBeNull();
    expect(buildContactsMap([])).toBeNull();
  });

  it("maps contacts by string id", () => {
    const a = { id: 1, name: "A" } as Contact;
    const b = { id: "abc", name: "B" } as Contact;
    const map = buildContactsMap([a, b]);
    expect(map?.get("1")).toBe(a);
    expect(map?.get("abc")).toBe(b);
  });

  it("skips contacts without an id", () => {
    const map = buildContactsMap([
      { name: "NoId" } as Contact,
      { id: 7, name: "Seven" } as Contact,
    ]);
    expect(map?.size).toBe(1);
    expect(map?.get("7")?.name).toBe("Seven");
  });
});

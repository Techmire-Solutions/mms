import { describe, expect, it } from "vitest";
import { calculateSmsSegments } from "../messaging/smsUtils.js";
import {
  parsePhoneNumber,
  normalizeToE164,
  formatPhoneWithCountryCode,
  getPrimaryPhone,
  mergeContacts,
  applyTitleCaseRecursive,
  applyTitleCaseToContact,
  formatMoney,
  formatNumber,
  formatDateToIso,
  todayISO,
  parseIsoDate,
  parseIsoYear,
  parseTimeHHmm,
  formatTimeHHmm,
  normalizeTimeHHmm,
  splitIsoDateTime,
  combineIsoDateAndTime,
  calcPercentage,
  calculateDetailedSolarAge,
  getSolarAgeComponents,
  formatSolarAgeComponents,
  getLunarDateString,
  calculateDetailedLunarAge,
  parseUtcDateParts,
  capitalize,
  getPrimaryAddress,
  compareByField,
  paginateArray,
  personalizeMessage,
  validateRecipientAddress,
  getDisplayName,
  MESSAGING_VARIABLE_TOKENS,
  formatHijriDate,
  formatSolarHijriDate,
} from "./utils.js";
import {
  normalizeContactForEdit,
  syncContactScalarFields,
  mergeContactEditSavePayload,
} from "../contacts/contactFormNormalize.js";
import { cleanContactDraft } from "../contacts/contactItemNormalize.js";

import { registerFinanceCurrencyProvider } from "../finance/moneyFormatUtils.js";

import type { Contact } from "../contacts/contactTypes.js";

describe("parsePhoneNumber", () => {
  it("parses E.164 with space separator", () => {
    expect(parsePhoneNumber("+92 300 1234567")).toEqual({
      countryCode: "+92",
      number: "300 1234567",
    });
  });

  it("returns default code for bare local number", () => {
    expect(parsePhoneNumber("03001234567", "+92")).toEqual({
      countryCode: "+92",
      number: "03001234567",
    });
  });

  it("does not assume a country code for a bare local number", () => {
    expect(parsePhoneNumber("03001234567")).toEqual({
      countryCode: "",
      number: "03001234567",
    });
  });

  it("handles empty input", () => {
    expect(parsePhoneNumber("", "+1")).toEqual({ countryCode: "+1", number: "" });
  });

  it("handles 00 prefix", () => {
    expect(parsePhoneNumber("00923001234567", "+92")).toEqual({
      countryCode: "+92",
      number: "3001234567",
    });
  });

  it("parses non-spaced number correctly with knownCodes", () => {
    expect(parsePhoneNumber("+923001234567", "+92", ["+92"])).toEqual({
      countryCode: "+92",
      number: "3001234567",
    });
  });

  it("falls back to greedy parsing when knownCodes is empty", () => {
    expect(parsePhoneNumber("+923001234567", "+92", [])).toEqual({
      countryCode: "+92", // Matches "+92" because it's listed in internal common codes (+92)
      number: "3001234567",
    });
    expect(parsePhoneNumber("+9993001234567", "+92", [])).toEqual({
      countryCode: "+9993", // Greedily matches 4 digits because +9993 is not in common list
      number: "001234567",
    });
  });
});

describe("formatPhoneWithCountryCode", () => {
  it("formats local zero-prefixed numbers with default country code", () => {
    expect(formatPhoneWithCountryCode("03001234567", "+92")).toBe("+92 3001234567");
  });

  it("formats bare number with default country code", () => {
    expect(formatPhoneWithCountryCode("3001234567", "+92")).toBe("+92 3001234567");
  });

  it("retains existing country code if present", () => {
    expect(formatPhoneWithCountryCode("+923001234567")).toBe("+92 3001234567");
    expect(formatPhoneWithCountryCode("+15551234567", "+92")).toBe("+1 5551234567");
  });

  it("returns null for empty or null phone input", () => {
    expect(formatPhoneWithCountryCode(null)).toBeNull();
    expect(formatPhoneWithCountryCode("")).toBeNull();
  });

  it("preserves a local number when no country code is configured", () => {
    expect(formatPhoneWithCountryCode("03001234567")).toBe("03001234567");
  });
});

describe("getPrimaryPhone", () => {
  it("extracts and formats primary phone with country code from phones array", () => {
    const contact = {
      phones: [{ number: "03001234567", countryCode: "+92", isPrimary: true }],
    } as unknown as Contact;
    expect(getPrimaryPhone(contact)).toBe("+92 3001234567");
  });

  it("formats scalar phone field with country code fallback", () => {
    const contact = { phone: "3012048693" } as unknown as Contact;
    expect(getPrimaryPhone(contact, "+92")).toBe("+92 3012048693");
  });
});

describe("normalizeToE164", () => {
  it("combines country code and local number", () => {
    expect(normalizeToE164("+92", "300-1234567")).toBe("+923001234567");
  });

  it("strips leading zero from local part", () => {
    expect(normalizeToE164("+92", "03001234567")).toBe("+923001234567");
  });
});

describe("mergeContacts", () => {
  const base: Contact = {
    id: "1",
    firstName: "Ali",
    lastName: "Khan",
    name: "Ali Khan",
    phones: [{ label: "Mobile", number: "3001111111", countryCode: "+92" }],
  };

  const other: Contact = {
    id: "2",
    firstName: "Ali",
    lastName: "Khan",
    name: "Ali Khan",
    emails: [{ label: "Personal", address: "ali@example.com" }],
  };

  it("merges collection fields", () => {
    const merged = mergeContacts(base, other);
    expect(merged.emails).toHaveLength(1);
    expect(merged.phones).toHaveLength(1);
  });
});

describe("applyTitleCaseRecursive", () => {
  it("converts simple string fields to Title Case", () => {
    expect(applyTitleCaseRecursive("john doe")).toBe("John Doe");
    expect(applyTitleCaseRecursive("alice smith-jones")).toBe("Alice Smith-jones");
  });

  it("recursively processes objects and arrays", () => {
    const input = {
      name: "john doe",
      description: "some long description",
      tags: ["first tag", "second tag"],
      nested: {
        note: "this is nested note",
      },
    };
    const expected = {
      name: "John Doe",
      description: "Some Long Description",
      tags: ["First Tag", "Second Tag"],
      nested: {
        note: "This Is Nested Note",
      },
    };
    expect(applyTitleCaseRecursive(input)).toEqual(expected);
  });

  it("ignores technical and system keys", () => {
    const input = {
      id: "some_id",
      userId: "user_123",
      email: "user@domain.com",
      status: "pending_verification",
      role: "assistant_teacher",
      _privateField: "dont touch me",
      name: "should be changed",
    };
    const expected = {
      id: "some_id",
      userId: "user_123",
      email: "user@domain.com",
      status: "pending_verification",
      role: "assistant_teacher",
      _privateField: "dont touch me",
      name: "Should Be Changed",
    };
    expect(applyTitleCaseRecursive(input)).toEqual(expected);
  });

  it("ignores soft-delete audit keys", () => {
    const input = {
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedBy: "u-admin",
      deletionReason: "duplicate entry",
      name: "should be changed",
    };
    const expected = {
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedBy: "u-admin",
      deletionReason: "duplicate entry",
      name: "Should Be Changed",
    };
    expect(applyTitleCaseRecursive(input)).toEqual(expected);
  });

  it("applyTitleCaseToContact ignores soft-delete audit keys", () => {
    const input = {
      name: "should be changed",
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedBy: "u-admin",
      deletionReason: "duplicate entry",
    };
    const result = applyTitleCaseToContact(input);
    expect(result.deletedBy).toBe("u-admin");
    expect(result.deletionReason).toBe("duplicate entry");
    expect(result.deletedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.name).toBe("Should Be Changed");
  });

  it("ignores non-eligible strings like URLs, phone numbers, and dates", () => {
    const input = {
      website: "https://example.com/some-page",
      birthday: "2026-07-03",
      phone: "+92 300 1234567",
      phoneNumber: "03001234567",
      address: "123 main street",
    };
    const expected = {
      website: "https://example.com/some-page",
      birthday: "2026-07-03",
      phone: "+92 300 1234567",
      phoneNumber: "03001234567",
      address: "123 Main Street",
    };
    expect(applyTitleCaseRecursive(input)).toEqual(expected);
  });
});

describe("formatMoney", () => {
  it("formats standard number with default PKR", () => {
    expect(formatMoney(1500)).toBe("PKR 1,500");
    expect(formatMoney(0)).toBe("PKR 0");
  });

  it("handles string numbers and decimal limits", () => {
    expect(formatMoney("25000")).toBe("PKR 25,000");
    expect(formatMoney(1234.567)).toBe("PKR 1,234.57");
  });

  it("handles custom currencies", () => {
    expect(formatMoney(100, "USD")).toBe("USD 100");
    expect(formatMoney(50.5, "₨")).toBe("₨ 50.5");
  });

  it("gracefully falls back for invalid/missing values", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney("invalid")).toBe("—");
  });

  it("supports formatting with symbols, decimal override, and currency code exclusion", () => {
    // Symbol prefixing
    expect(formatMoney(1500, "USD", { useSymbol: true })).toBe("$ 1,500");
    expect(formatMoney(1500, "PKR", { useSymbol: true })).toBe("₨ 1,500");

    // Decimal overriding
    expect(
      formatMoney(1234.56, "PKR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
    ).toBe("PKR 1,234.560");
    expect(formatMoney(1234.5, "USD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })).toBe(
      "USD 1,235",
    );

    // Exclude currency prefix
    expect(formatMoney(1234.56, "PKR", { excludeCurrency: true })).toBe("1,234.56");
    expect(
      formatMoney(1234.56, "PKR", {
        excludeCurrency: true,
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }),
    ).toBe("1,234.5600");
  });

  it("resolves the fallback currency from the registered finance provider", () => {
    registerFinanceCurrencyProvider(() => "GBP");
    try {
      expect(formatMoney(100)).toBe("GBP 100");
    } finally {
      registerFinanceCurrencyProvider(null);
    }
  });
});

describe("formatNumber", () => {
  it("formats standard numbers and numeric strings", () => {
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber("56789")).toBe("56,789");
    expect(formatNumber(0)).toBe("0");
  });

  it("handles null, undefined, and NaN gracefully", () => {
    expect(formatNumber(null)).toBe("0");
    expect(formatNumber(undefined)).toBe("0");
    expect(formatNumber("invalid")).toBe("0");
  });

  it("respects custom Intl options", () => {
    expect(formatNumber(12.3456, { maximumFractionDigits: 2 })).toBe("12.35");
  });
});

describe("formatDateToIso", () => {
  it("formats standard date to YYYY-MM-DD", () => {
    const date1 = new Date(2026, 0, 5); // Jan 5, 2026
    expect(formatDateToIso(date1)).toBe("2026-01-05");

    const date2 = new Date(2026, 11, 25); // Dec 25, 2026
    expect(formatDateToIso(date2)).toBe("2026-12-25");
  });
});

describe("todayISO", () => {
  it("returns local calendar day matching formatDateToIso", () => {
    expect(todayISO()).toBe(formatDateToIso(new Date()));
  });
});

describe("parseIsoDate", () => {
  it("parses YYYY-MM-DD into a local midnight Date", () => {
    const parsed = parseIsoDate("2026-01-05");
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(0);
    expect(parsed?.getDate()).toBe(5);
  });

  it("returns undefined for missing or invalid input", () => {
    expect(parseIsoDate()).toBeUndefined();
    expect(parseIsoDate("")).toBeUndefined();
    expect(parseIsoDate("not-a-date")).toBeUndefined();
  });
});

describe("parseTimeHHmm", () => {
  it("parses HH:mm and HH:mm:ss", () => {
    expect(parseTimeHHmm("09:05")).toEqual({ hours: 9, minutes: 5 });
    expect(parseTimeHHmm("23:59:30")).toEqual({ hours: 23, minutes: 59 });
  });

  it("rejects invalid clock times", () => {
    expect(parseTimeHHmm("")).toBeNull();
    expect(parseTimeHHmm("24:00")).toBeNull();
    expect(parseTimeHHmm("12:60")).toBeNull();
    expect(parseTimeHHmm("noon")).toBeNull();
  });
});

describe("formatTimeHHmm / normalizeTimeHHmm", () => {
  it("zero-pads hours and minutes", () => {
    expect(formatTimeHHmm(9, 5)).toBe("09:05");
  });

  it("strips seconds from browser time values", () => {
    expect(normalizeTimeHHmm("09:05:30")).toBe("09:05");
    expect(normalizeTimeHHmm("")).toBe("");
    expect(normalizeTimeHHmm("bad")).toBe("");
  });
});

describe("splitIsoDateTime / combineIsoDateAndTime", () => {
  it("round-trips local date and time through ISO", () => {
    const combined = combineIsoDateAndTime("2026-01-05", "14:30");
    expect(typeof combined).toBe("string");
    expect(combined).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    const parts = splitIsoDateTime(combined!);
    expect(parts).toEqual({ date: "2026-01-05", time: "14:30" });
  });

  it("returns null for empty date or invalid ISO", () => {
    expect(combineIsoDateAndTime("", "14:30")).toBeNull();
    expect(combineIsoDateAndTime("not-a-date", "14:30")).toBeNull();
    expect(splitIsoDateTime("")).toBeNull();
    expect(splitIsoDateTime("not-a-date")).toBeNull();
  });

  it("defaults missing time to midnight when combining", () => {
    const combined = combineIsoDateAndTime("2026-01-05", "");
    expect(typeof combined).toBe("string");
    expect(combined).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(splitIsoDateTime(combined!)).toEqual({ date: "2026-01-05", time: "00:00" });
  });
});

describe("parseIsoYear", () => {
  it("returns the year portion of an ISO date", () => {
    expect(parseIsoYear("2026-01-05")).toBe(2026);
  });

  it("returns undefined for missing or invalid input", () => {
    expect(parseIsoYear()).toBeUndefined();
    expect(parseIsoYear("")).toBeUndefined();
  });
});

describe("calcPercentage", () => {
  it("calculates percentage correctly and rounds to nearest integer", () => {
    expect(calcPercentage(25, 100)).toBe(25);
    expect(calcPercentage(1, 3)).toBe(33);
    expect(calcPercentage(2, 3)).toBe(67);
  });

  it("handles zero, NaN, and negative total safely without divide-by-zero", () => {
    expect(calcPercentage(10, 0)).toBe(0);
    expect(calcPercentage(10, -5)).toBe(0);
    expect(calcPercentage(0, 100)).toBe(0);
    expect(Number.isNaN(calcPercentage(NaN, 100))).toBe(true);
  });
});

describe("calculateDetailedSolarAge", () => {
  it("calculates accurate age in years, months, and days format", () => {
    const age = calculateDetailedSolarAge("2000-01-01");
    expect(age).toMatch(/^\d+y \d+m \d+d$/);
  });

  it("decomposes pure date components correctly", () => {
    const relativeTo = new Date("2025-06-15T00:00:00.000Z");
    const components = getSolarAgeComponents("2000-01-01", relativeTo);
    expect(components).toEqual({ years: 25, months: 5, days: 14 });
    expect(formatSolarAgeComponents(components)).toBe("25y 5m 14d");
  });

  it("handles ISO timestamp strings correctly", () => {
    const age = calculateDetailedSolarAge("2000-01-01T00:00:00.000Z");
    expect(age).toMatch(/^\d+y \d+m \d+d$/);
  });

  it.each([
    ["empty string", ""],
    ["invalid string", "invalid-date"],
    ["future date", "2099-01-01"],
  ])("returns empty string for %s", (_, input) => {
    expect(calculateDetailedSolarAge(input)).toBe("");
  });
});

describe("getLunarDateString", () => {
  it("converts Gregorian date to localized Hijri string", () => {
    const result = getLunarDateString("2000-01-01");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("—");
  });

  it.each([
    ["empty string", ""],
    ["invalid string", "invalid"],
  ])("returns empty string for %s", (_, input) => {
    expect(getLunarDateString(input)).toBe("");
  });
});

describe("formatHijriDate", () => {
  it("formats date into Hijri calendar string", () => {
    const result = formatHijriDate("2026-03-20");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("—");
  });

  it("supports explicit Umm al-Qura calendar option", () => {
    const umAlQura = formatHijriDate("2026-03-20", { calendar: "islamic-umalqura" });
    expect(typeof umAlQura).toBe("string");
    expect(umAlQura.length).toBeGreaterThan(0);
    expect(umAlQura).not.toBe("—");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
  ])("returns em-dash for %s", (_, input) => {
    expect(formatHijriDate(input)).toBe("—");
  });

  it("returns empty string for invalid date string", () => {
    expect(formatHijriDate("not-a-date")).toBe("");
  });
});

describe("formatSolarHijriDate", () => {
  it("formats date into Solar Hijri (Persian / Shamsi) calendar string", () => {
    const result = formatSolarHijriDate("2026-03-20");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("—");
  });

  it("supports locale override for Persian Solar calendar", () => {
    const resultFa = formatSolarHijriDate("2026-03-20", "fa-IR");
    expect(typeof resultFa).toBe("string");
    expect(resultFa.length).toBeGreaterThan(0);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
  ])("returns em-dash for %s", (_, input) => {
    expect(formatSolarHijriDate(input)).toBe("—");
  });

  it("returns empty string for invalid date string", () => {
    expect(formatSolarHijriDate("not-a-date")).toBe("");
  });
});

describe("calculateDetailedLunarAge", () => {
  it("calculates detailed Hijri lunar age in years, months, and days", () => {
    const age = calculateDetailedLunarAge("2000-01-01");
    expect(age).toMatch(/^\d+y \d+m \d+d$/);
  });

  it.each([
    ["empty string", ""],
    ["invalid string", "invalid-date"],
    ["future date", "2099-01-01"],
  ])("returns empty string for %s", (_, input) => {
    expect(calculateDetailedLunarAge(input)).toBe("");
  });
});

describe("parseUtcDateParts", () => {
  it("parses YYYY-MM-DD date string into UTC components", () => {
    const parts = parseUtcDateParts("1995-05-15");
    expect(parts).toEqual({
      year: 1995,
      month: 4, // 0-indexed May
      day: 15,
      date: new Date(Date.UTC(1995, 4, 15)),
    });
  });

  it("handles ISO timestamps safely", () => {
    const parts = parseUtcDateParts("2000-01-01T12:34:56.789Z");
    expect(parts?.year).toBe(2000);
    expect(parts?.month).toBe(0);
    expect(parts?.day).toBe(1);
  });

  it.each([
    ["null input", null],
    ["empty string", ""],
    ["invalid string", "invalid-date"],
  ])("returns null for %s", (_, input) => {
    expect(parseUtcDateParts(input)).toBeNull();
  });
});

describe("capitalize", () => {
  it("capitalizes the first character of string tokens", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("world")).toBe("World");
    expect(capitalize("alreadyCapital")).toBe("AlreadyCapital");
  });

  it("handles empty or falsy strings gracefully", () => {
    expect(capitalize("")).toBe("");
  });
});

describe("getPrimaryAddress", () => {
  it("returns address marked isPrimary when present", () => {
    const contact: Partial<Contact> = {
      addresses: [
        { line1: "123 Secondary St", city: "Lahore", isPrimary: false },
        { line1: "456 Primary Ave", city: "Karachi", isPrimary: true },
      ],
    };
    expect(getPrimaryAddress(contact)).toEqual({
      line1: "456 Primary Ave",
      city: "Karachi",
      isPrimary: true,
    });
  });

  it("falls back to first address if none is explicitly primary", () => {
    const contact: Partial<Contact> = {
      addresses: [{ line1: "789 First St", city: "Islamabad" }],
    };
    expect(getPrimaryAddress(contact)).toEqual({ line1: "789 First St", city: "Islamabad" });
  });

  it("returns null if addresses array is empty or undefined", () => {
    expect(getPrimaryAddress({})).toBeNull();
    expect(getPrimaryAddress({ addresses: [] })).toBeNull();
  });
});

describe("compareByField", () => {
  it("sorts objects by string property ascending and descending", () => {
    const items = [{ name: "Zaid" }, { name: "Ali" }, { name: "Bilal" }];
    const asc = [...items].sort((a, b) => compareByField(a, b, "name", "asc"));
    expect(asc.map((i) => i.name)).toEqual(["Ali", "Bilal", "Zaid"]);

    const desc = [...items].sort((a, b) => compareByField(a, b, "name", "desc"));
    expect(desc.map((i) => i.name)).toEqual(["Zaid", "Bilal", "Ali"]);
  });

  it("handles nullish properties gracefully", () => {
    const items = [{ role: null }, { role: "Teacher" }, { role: "Admin" }];
    const asc = [...items].sort((a, b) => compareByField(a, b, "role", "asc"));
    expect(asc.map((i) => i.role)).toEqual([null, "Admin", "Teacher"]);
  });
});

describe("paginateArray", () => {
  it("slices array correctly with metadata", () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const page1 = paginateArray(data, 1, 3);
    expect(page1.items).toEqual([1, 2, 3]);
    expect(page1.total).toBe(10);
    expect(page1.page).toBe(1);
    expect(page1.limit).toBe(3);
    expect(page1.hasMore).toBe(true);

    const page4 = paginateArray(data, 4, 3);
    expect(page4.items).toEqual([10]);
    expect(page4.hasMore).toBe(false);
  });

  it("enforces safe page and max limit bounds", () => {
    const data = Array.from({ length: 100 }, (_, i) => i + 1);
    const capped = paginateArray(data, 0, 1000, 50);
    expect(capped.page).toBe(1);
    expect(capped.limit).toBe(50);
    expect(capped.items.length).toBe(50);
  });
});

describe("personalizeMessage", () => {
  it("replaces {name}, {first_name}, {phone}, {email}, and {date} placeholders case-insensitively", () => {
    const body =
      "Dear {NAME}, your first name is {first_name}. Contact: {phone}, {email} on {DATE}.";
    const recipient = {
      name: "Syed Muhammad Ali",
      phone: "+92 300 1234567",
      email: "ali@example.com",
    };
    const result = personalizeMessage(body, recipient, { date: "2026-07-25" });
    expect(result).toBe(
      "Dear Syed Muhammad Ali, your first name is Syed. Contact: +92 300 1234567, ali@example.com on 2026-07-25.",
    );
  });

  it("replaces extended dynamic placeholders like {due_date}, {amount}, {madrasa_name}, and {salutation}", () => {
    const body = "{salutation} {name}, payment of {amount} is due by {due_date} at {madrasa_name}.";
    const recipient = {
      salutation: "Respected",
      name: "Ahmad Raza",
      amount: "5,000 PKR",
      dueDate: "2026-08-01",
      madrasaName: "Madrasa Anwar-ul-Uloom",
    };
    const result = personalizeMessage(body, recipient);
    expect(result).toBe(
      "Respected Ahmad Raza, payment of 5,000 PKR is due by 2026-08-01 at Madrasa Anwar-ul-Uloom.",
    );
  });

  it("handles missing recipient fields gracefully", () => {
    const body = "Hello {name} ({email})";
    expect(personalizeMessage(body, {})).toBe("Hello  ()");
  });

  it("supports default fallback syntax {token|default_value} when recipient field is missing", () => {
    const body =
      "Dear {name|Valued Parent}, your balance of {amount|0 PKR} is due at {madrasa_name|Madrasa}.";
    const recipientWithoutName = { amount: "1,500 PKR" };
    expect(personalizeMessage(body, recipientWithoutName)).toBe(
      "Dear Valued Parent, your balance of 1,500 PKR is due at Madrasa.",
    );
  });

  it("returns empty string when body is empty", () => {
    expect(personalizeMessage("", { name: "Ali" })).toBe("");
  });
});

describe("calculateSmsSegments", () => {
  it("calculates GSM 7-bit single segment correctly", () => {
    const res = calculateSmsSegments("Hello world");
    expect(res.isUnicode).toBe(false);
    expect(res.charCount).toBe(11);
    expect(res.totalSegments).toBe(1);
    expect(res.remainingInSegment).toBe(149);
  });

  it("calculates GSM 7-bit multi-segment correctly", () => {
    const text = "A".repeat(170);
    const res = calculateSmsSegments(text);
    expect(res.isUnicode).toBe(false);
    expect(res.charCount).toBe(170);
    expect(res.totalSegments).toBe(2);
    expect(res.remainingInSegment).toBe(136); // 153 - 17
  });

  it("detects Unicode text and calculates Unicode segments correctly", () => {
    const res = calculateSmsSegments("مرحبا بكم في المدرسة");
    expect(res.isUnicode).toBe(true);
    expect(res.charCount).toBe(20);
    expect(res.totalSegments).toBe(1);
    expect(res.remainingInSegment).toBe(50); // 70 - 20
  });

  it("calculates Unicode multi-segment correctly", () => {
    const text = "السلام عليكم ورحمة الله وبركاته ".repeat(3); // 96 chars
    const res = calculateSmsSegments(text);
    expect(res.isUnicode).toBe(true);
    expect(res.charCount).toBe(96);
    expect(res.totalSegments).toBe(2);
    expect(res.remainingInSegment).toBe(38); // 67 - (96 % 67) = 38
  });
});

describe("validateRecipientAddress", () => {
  it("validates email addresses correctly", () => {
    expect(validateRecipientAddress({ email: "user@example.com" }, "email")).toEqual({
      isValid: true,
      address: "user@example.com",
    });

    expect(validateRecipientAddress({ email: "invalid-email" }, "email")).toEqual({
      isValid: false,
      address: "invalid-email",
      reason: "invalid_email_format",
    });

    expect(validateRecipientAddress({}, "email")).toEqual({
      isValid: false,
      address: "",
      reason: "missing_email",
    });
  });

  it("validates phone numbers correctly for sms/whatsapp", () => {
    expect(validateRecipientAddress({ phone: "+92 300 1234567" }, "whatsapp")).toEqual({
      isValid: true,
      address: "923001234567",
      reason: undefined,
    });

    expect(validateRecipientAddress({ phone: "123" }, "sms")).toEqual({
      isValid: false,
      address: "123",
      reason: "invalid_phone_format",
    });

    expect(validateRecipientAddress({}, "sms")).toEqual({
      isValid: false,
      address: "",
      reason: "missing_phone",
    });
  });

  it("exports MESSAGING_VARIABLE_TOKENS with standard keys", () => {
    expect(MESSAGING_VARIABLE_TOKENS.length).toBeGreaterThan(5);
    const hasNameToken = MESSAGING_VARIABLE_TOKENS.some((t) => t.token === "{name}");
    expect(hasNameToken).toBe(true);
  });
});

describe("getDisplayName", () => {
  it("composes firstName and lastName when name is empty", () => {
    expect(
      getDisplayName({
        id: "c1",
        firstName: "John",
        lastName: "Doe",
      } as Contact),
    ).toBe("John Doe");
  });

  it("prefixes Syed for male isSyed contacts", () => {
    expect(
      getDisplayName({
        id: "c1",
        name: "Ahmed",
        isSyed: true,
        gender: "male",
      } as Contact),
    ).toBe("Syed Ahmed");
  });
});

describe("normalizeContactForEdit", () => {
  it("pre-populates one empty row for socials and relationship contacts", () => {
    const draft = normalizeContactForEdit(undefined, undefined);
    expect(draft.socials).toEqual([{ platform: "Facebook", url: "" }]);
    expect(draft.relationshipContacts).toEqual([{ relationship: "Parent", contactId: "" }]);
  });

  it("keeps existing socials and relationship contacts", () => {
    const draft = normalizeContactForEdit(
      {
        socials: [{ platform: "Instagram", url: "https://instagram.com/a" }],
        relationshipContacts: [{ relationship: "Mother", contactId: "c-2" }],
      },
      undefined,
    );
    expect(draft.socials).toEqual([{ platform: "Instagram", url: "https://instagram.com/a" }]);
    expect(draft.relationshipContacts).toEqual([{ relationship: "Mother", contactId: "c-2" }]);
  });

  it("seeds empty rows from tenant option defaults", () => {
    const draft = normalizeContactForEdit(undefined, undefined, "", "", "", {
      phoneLabel: "Work",
      emailLabel: "Office",
      addressLabel: "Office",
      socialPlatform: "LinkedIn",
      relationship: "Guardian",
      defaultPhoneCountryCode: "+1",
    });
    expect(draft.phones).toEqual([
      { label: "Work", number: "", countryCode: "+1", isPrimary: true },
    ]);
    expect(draft.emails).toEqual([{ label: "Office", address: "", isPrimary: true }]);
    expect(draft.addresses).toEqual([
      { label: "Office", line1: "", city: "", state: "", country: "", isPrimary: true },
    ]);
    expect(draft.socials).toEqual([{ platform: "LinkedIn", url: "" }]);
    expect(draft.relationshipContacts).toEqual([{ relationship: "Guardian", contactId: "" }]);
  });

  it("does not resurrect deleted phones from a leftover scalar", () => {
    const draft = normalizeContactForEdit(
      {
        phones: [],
        phone: "+923001234567",
        emails: [],
        email: "stale@example.com",
      },
      undefined,
    );
    expect(draft.phones).toEqual([expect.objectContaining({ number: "", isPrimary: true })]);
    expect(draft.emails).toEqual([expect.objectContaining({ address: "", isPrimary: true })]);
  });

  it("still hydrates legacy scalar-only contacts into collection rows", () => {
    const draft = normalizeContactForEdit(
      {
        phone: "+923001234567",
        email: "legacy@example.com",
      },
      undefined,
    );
    expect(draft.phones?.[0]).toEqual(expect.objectContaining({ number: expect.any(String) }));
    expect((draft.phones?.[0]?.number || "").length).toBeGreaterThan(0);
    expect(draft.emails?.[0]).toEqual(expect.objectContaining({ address: "legacy@example.com" }));
  });
});

describe("syncContactScalarFields", () => {
  it("clears scalar phone/email when collections are explicitly empty", () => {
    const synced = syncContactScalarFields({
      phones: [],
      emails: [],
      addresses: [],
      phone: "+923001234567",
      email: "stale@example.com",
      line1: "Old street",
    } as Partial<Contact>);
    expect(synced.phone).toBe("");
    expect(synced.email).toBe("");
    expect(synced.line1).toBe("");
  });

  it("derives scalars from primary collection rows", () => {
    const synced = syncContactScalarFields({
      phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92", isPrimary: true }],
      emails: [{ label: "Home", address: "a@example.com", isPrimary: true }],
      addresses: [
        {
          label: "Home",
          line1: "1 Main",
          city: "Lahore",
          state: "Punjab",
          country: "PK",
          isPrimary: true,
        },
      ],
    } as Partial<Contact>);
    expect(synced.phone).toBe("+92 3001234567");
    expect(synced.email).toBe("a@example.com");
    expect(synced.line1).toBe("1 Main");
    expect(synced.city).toBe("Lahore");
  });
});

describe("mergeContactEditSavePayload", () => {
  it("does not resurrect deleted collections or scalars from the existing contact", () => {
    const existing = {
      id: "c1",
      firstName: "Ahmed",
      name: "Ahmed",
      phone: "+923001234567",
      phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92", isPrimary: true }],
      email: "old@example.com",
      emails: [{ label: "Home", address: "old@example.com", isPrimary: true }],
      address: "1 Main",
      line1: "1 Main",
      city: "Lahore",
      addresses: [{ label: "Home", line1: "1 Main", city: "Lahore", isPrimary: true }],
      socials: [{ platform: "Instagram", url: "https://instagram.com/a" }],
      relationshipContacts: [{ relationship: "Father", contactId: "c-2" }],
      relationships: [{ contactId: "c-2", relationship: "father" }],
    } as Partial<Contact>;

    const payload = mergeContactEditSavePayload(existing, {
      id: "c1",
      firstName: "Ahmed",
      name: "Ahmed",
      phones: [],
      emails: [],
      addresses: [],
      socials: [],
      relationshipContacts: [],
    });

    expect(payload.phones).toEqual([]);
    expect(payload.phone).toBe("");
    expect(payload.emails).toEqual([]);
    expect(payload.email).toBe("");
    expect(payload.addresses).toEqual([]);
    expect(payload.address).toBe("");
    expect(payload.line1).toBe("");
    expect(payload.city).toBe("");
    expect(payload.socials).toEqual([]);
    expect(payload.relationshipContacts).toEqual([]);
    expect(payload.relationships).toEqual([]);
  });

  it("updates tags and strips stale existing tag scalar string", () => {
    const existing = {
      id: "c1",
      firstName: "Fatima",
      tag: "OldTag",
      tags: ["OldTag"],
    } as Partial<Contact>;

    const payload = mergeContactEditSavePayload(existing, {
      id: "c1",
      firstName: "Fatima",
      tags: ["NewTag", "VIP"],
      tag: "NewTag, VIP",
    });

    expect(payload.tags).toEqual(["NewTag", "VIP"]);
    expect((payload as Record<string, unknown>).tag).toBeUndefined();
  });
});

describe("cleanContactDraft", () => {
  it("strips blank social and relationship rows before save", () => {
    const cleaned = cleanContactDraft({
      socials: [
        { platform: "WhatsApp", url: "" },
        { platform: "Instagram", url: "https://instagram.com/a" },
      ],
      relationshipContacts: [
        { relationship: "Father", contactId: "" },
        { relationship: "Mother", contactId: "c-2" },
      ],
    });
    expect(cleaned.socials).toEqual([{ platform: "Instagram", url: "https://instagram.com/a" }]);
    expect(cleaned.relationshipContacts).toEqual([{ relationship: "Mother", contactId: "c-2" }]);
  });

  it("keeps addresses with city/state/country even when line1 is blank", () => {
    const cleaned = cleanContactDraft({
      addresses: [
        { label: "Home", line1: "", city: "", state: "", country: "" },
        { label: "Work", line1: "", city: "Karachi", state: "", country: "" },
      ],
    });
    expect(cleaned.addresses).toEqual([
      { label: "Work", line1: "", city: "Karachi", state: "", country: "", isPrimary: true },
    ]);
  });

  it("keeps list rows that only have custom field content", () => {
    const cleaned = cleanContactDraft({
      phones: [
        { label: "Mobile", number: "", countryCode: "+92", note: "" },
        { label: "Mobile", number: "", countryCode: "+92", note: "School line" },
      ],
    } as unknown as Partial<Contact>);
    expect(cleaned.phones).toEqual([
      {
        label: "Mobile",
        number: "",
        countryCode: "+92",
        note: "School line",
        isPrimary: true,
      },
    ]);
  });

  it("clears legacy relationships when relationship contacts are emptied", () => {
    const cleaned = cleanContactDraft({
      relationshipContacts: [{ relationship: "Father", contactId: "" }],
      relationships: [{ contactId: "c-2", relationship: "father" }],
    });
    expect(cleaned.relationshipContacts).toEqual([]);
    expect(cleaned.relationships).toEqual([]);
  });

  it("strips blank custom collection tab rows before save", () => {
    const cleaned = cleanContactDraft({
      custom_work: [
        { title: "", notes: "" },
        { title: "Teacher", notes: "" },
      ],
    } as Partial<Contact>);
    expect(cleaned.custom_work).toEqual([{ title: "Teacher", notes: "" }]);
  });
});

import { describe, expect, it } from "vitest";
import type { Contact } from "../contacts/contactTypes.js";
import {
  contactMatchesSearch,
  getContactSearchHaystack,
  normalizeSearchString,
} from "../contacts/contactsSearchUtils.js";

describe("contactsSearchUtils", () => {
  it("matches name and email in search haystack", () => {
    const contact = {
      id: "1",
      name: "Ali Khan",
      emails: [{ label: "Work", address: "ali@example.com" }],
    } as Contact;
    expect(getContactSearchHaystack(contact)).toContain("ali@example.com");
    expect(contactMatchesSearch(contact, "ali@")).toBe(true);
    expect(contactMatchesSearch(contact, "missing")).toBe(false);
  });

  it("normalizes search strings (diacritics, Arabic/Urdu Yeh and Kaf)", () => {
    // Diacritics/Accents stripping
    expect(normalizeSearchString("Alí Khân")).toBe("ali khan");

    // Arabic diacritics (harakat)
    expect(normalizeSearchString("مُحَمَّد")).toBe("محمد");

    // Arabic vs Urdu/Persian Yeh (ي to ی)
    expect(normalizeSearchString("علي")).toBe("علی");

    // Arabic vs Urdu/Persian Kaf (ك to ک)
    expect(normalizeSearchString("أبو بكر")).toBe("ابو بکر");
  });

  it("matches contacts using normalized multilingual queries", () => {
    const contact = {
      id: "2",
      name: "عَلِی خَان", // Urdu Yeh with Harakat/diacritics
    } as Contact;

    // Direct match (ignoring diacritics)
    expect(contactMatchesSearch(contact, "علی")).toBe(true);

    // Matching Arabic query 'علي' against Urdu name 'عَلِی'
    expect(contactMatchesSearch(contact, "علي")).toBe(true);
  });

  it("safely handles null and undefined without throwing", () => {
    expect(normalizeSearchString(null)).toBe("");
    expect(normalizeSearchString(undefined)).toBe("");
    expect(getContactSearchHaystack(null)).toBe("");
    expect(getContactSearchHaystack(undefined)).toBe("");
    expect(contactMatchesSearch(null, "test")).toBe(false);
    expect(contactMatchesSearch(undefined, "test")).toBe(false);
    expect(contactMatchesSearch({ id: "1", name: "Test" } as Contact, null)).toBe(true);
    expect(contactMatchesSearch({ id: "1", name: "Test" } as Contact, undefined)).toBe(true);
    expect(contactMatchesSearch({ id: "1", name: "Test" } as Contact, "")).toBe(true);
  });

  it("includes CNIC, secondary phones, and scalar fields in haystack", () => {
    const contact = {
      id: "3",
      name: "Ahmed",
      cnic: "42201-1234567-1",
      phones: [
        { label: "work", number: "+92 300 1111111", isPrimary: true },
        { label: "home", number: "+92 321 2222222", isPrimary: false },
      ],
      phone: "+92 333 3333333",
      email: "ahmed@scalar.com",
    } as Contact;

    expect(contactMatchesSearch(contact, "42201-1234567-1")).toBe(true);
    expect(contactMatchesSearch(contact, "2222222")).toBe(true);
    expect(contactMatchesSearch(contact, "3333333")).toBe(true);
    expect(contactMatchesSearch(contact, "ahmed@scalar.com")).toBe(true);
  });
});

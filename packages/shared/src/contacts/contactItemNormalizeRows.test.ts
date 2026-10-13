import { describe, expect, it } from "vitest";
import {
  normalizeAddressItem,
  normalizeEmailItem,
  normalizePhoneItem,
  normalizeRelationshipContactItem,
  normalizeSocialItem,
} from "./contactItemNormalizeRows.js";

describe("normalizePhoneItem", () => {
  it("returns a default row for a falsy item with index-based primary", () => {
    expect(normalizePhoneItem(null)).toEqual({
      label: "Mobile",
      number: "",
      countryCode: "",
      isPrimary: true,
    });
    expect(normalizePhoneItem(undefined, 1)).toEqual({
      label: "Mobile",
      number: "",
      countryCode: "",
      isPrimary: false,
    });
  });

  it("normalizes a string entry with the resolved country code", () => {
    expect(normalizePhoneItem(" 3001234567 ")).toEqual({
      label: "Mobile",
      number: "3001234567",
      countryCode: "",
      isPrimary: true,
    });
    expect(normalizePhoneItem("3001234567", 0, "+92")).toMatchObject({
      number: "3001234567",
      countryCode: "+92",
    });
  });

  it("normalizes an object entry and retains extra keys", () => {
    const item = normalizePhoneItem({
      number: "3001234567",
      label: "Home",
      isPrimary: true,
      whatsappStatus: "UNCHECKED",
      note: "call after 5",
    });
    expect(item).toMatchObject({
      number: "3001234567",
      label: "Home",
      isPrimary: true,
      whatsappStatus: "PENDING",
    });
    expect(item).toHaveProperty("note", "call after 5");
  });

  it("honours label and default-code overrides", () => {
    const item = normalizePhoneItem("3001234567", 0, "", {
      phoneLabel: "Work",
      defaultPhoneCountryCode: "+971",
    });
    expect(item.label).toBe("Work");
    expect(item.countryCode).toBe("+971");
  });
});

describe("normalizeEmailItem", () => {
  it("returns a default row for a falsy item", () => {
    expect(normalizeEmailItem(null)).toEqual({ label: "Personal", address: "", isPrimary: true });
  });

  it("trims a string entry", () => {
    expect(normalizeEmailItem(" a@b.com ")).toEqual({
      label: "Personal",
      address: "a@b.com",
      isPrimary: true,
    });
  });

  it("normalizes an object entry with verification state", () => {
    expect(
      normalizeEmailItem({
        address: " a@b.com ",
        label: "Work",
        isPrimary: false,
        isVerified: true,
      }),
    ).toEqual({ label: "Work", address: "a@b.com", isPrimary: false, isVerified: true });
  });
});

describe("normalizeAddressItem", () => {
  it("returns a default row with provided defaults for a falsy item", () => {
    expect(normalizeAddressItem(null, "Lahore", "Punjab", "Pakistan")).toEqual({
      label: "Home",
      line1: "",
      city: "Lahore",
      state: "Punjab",
      country: "Pakistan",
      isPrimary: true,
    });
  });

  it("places a string entry into line1", () => {
    expect(normalizeAddressItem(" 1 Main St ")).toMatchObject({
      line1: "1 Main St",
      city: "",
      isPrimary: true,
    });
  });

  it("normalizes an object entry, preferring explicit fields", () => {
    expect(
      normalizeAddressItem({
        line1: "2 Main St",
        city: "Karachi",
        state: "Sindh",
        country: "Pakistan",
        label: "Office",
        isPrimary: true,
      }),
    ).toEqual({
      label: "Office",
      line1: "2 Main St",
      city: "Karachi",
      state: "Sindh",
      country: "Pakistan",
      isPrimary: true,
    });
  });
});

describe("normalizeSocialItem", () => {
  it("returns a default platform for a falsy item", () => {
    expect(normalizeSocialItem(null)).toEqual({ platform: "Facebook", url: "" });
  });

  it("normalizes a string URL", () => {
    expect(normalizeSocialItem(" https://x.com/a ")).toEqual({
      platform: "Facebook",
      url: "https://x.com/a",
    });
  });

  it("normalizes an object entry", () => {
    expect(normalizeSocialItem({ platform: "Instagram", url: "https://ig.com/a" })).toEqual({
      platform: "Instagram",
      url: "https://ig.com/a",
    });
  });
});

describe("normalizeRelationshipContactItem", () => {
  it("returns a default row for a falsy item", () => {
    expect(normalizeRelationshipContactItem(null)).toEqual({
      relationship: "Parent",
      contactId: "",
    });
  });

  it("treats a string/number as a contact id", () => {
    expect(normalizeRelationshipContactItem("c-1")).toEqual({
      relationship: "Parent",
      contactId: "c-1",
    });
    expect(normalizeRelationshipContactItem(42)).toEqual({
      relationship: "Parent",
      contactId: "42",
    });
  });

  it("normalizes an object entry", () => {
    expect(
      normalizeRelationshipContactItem({ contactId: "c-2", relationship: "Guardian" }),
    ).toEqual({ relationship: "Guardian", contactId: "c-2" });
  });

  it("preserves name, phone, and inferred metadata", () => {
    expect(
      normalizeRelationshipContactItem({
        contactId: "c-3",
        relationship: "Parent",
        name: "Fatima",
        phone: "+923001234567",
        inferred: true,
        inferredFromContactId: "c-1",
        inferenceDepth: 1,
      }),
    ).toEqual({
      relationship: "Parent",
      contactId: "c-3",
      name: "Fatima",
      phone: "+923001234567",
      inferred: true,
      inferredFromContactId: "c-1",
      inferenceDepth: 1,
    });
  });
});

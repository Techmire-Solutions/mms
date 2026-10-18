import { describe, expect, it } from "vitest";
import type { AppTranslationKey } from "@mms/shared";
import {
  formatContactOptionLabel,
  resolveRegistryLabel,
  resolveRegistryDescription,
  resolvePhoneLabel,
  resolveEmailLabel,
  resolveAddressLabel,
  resolveSocialPlatformLabel,
  formatContactGenderLabel,
  getSyncConflictKindLabel,
  getDuplicateFieldLabel,
  getFallbackCountryCode,
} from "@/lib/contacts/contactI18n";

const DICT: Partial<Record<AppTranslationKey, string>> = {
  "contacts.gender.male": "Male",
  "contacts.gender.female": "Female",
  "contacts.options.phone.mobile": "Mobile",
  "contacts.options.phone.home": "Home",
  "contacts.options.email.personal": "Personal",
  "contacts.options.address.billing": "Billing",
  "contacts.options.social.facebook": "Facebook",
  "contacts.options.relationship.father": "Father",
  "contacts.detail.mobileLabel": "Mobile",
  "contacts.detail.personalLabel": "Personal",
  "contacts.detail.homeLabel": "Home",
  "contacts.detail.socialFallback": "Social",
  "contacts.columns.name": "Name",
  "contacts.fields.firstNameDesc": "First name description",
  "contacts.sync.conflictKindCreate": "Create",
  "contacts.sync.conflictKindUpdate": "Update",
  "contacts.sync.conflictKindDelete": "Delete",
  "contacts.duplicates.field.name": "Name",
  "contacts.duplicates.field.phone": "Phone",
};

function t(key: AppTranslationKey): string {
  return DICT[key] ?? key;
}

describe("contactI18n resolvers", () => {
  it("formatContactOptionLabel maps known options and leaves custom values", () => {
    expect(formatContactOptionLabel("Mobile", t)).toBe("Mobile");
    expect(formatContactOptionLabel("Father", t)).toBe("Father");
    expect(formatContactOptionLabel("CustomLabel", t)).toBe("CustomLabel");
    expect(formatContactOptionLabel("", t)).toBe("");
  });

  it("resolveRegistryLabel prefers labelKey over English label", () => {
    expect(resolveRegistryLabel({ label: "Name", labelKey: "contacts.columns.name" }, t)).toBe(
      "Name",
    );
    expect(resolveRegistryLabel({ label: "Custom Col" }, t)).toBe("Custom Col");
  });

  it("resolveRegistryDescription prefers descriptionKey", () => {
    expect(
      resolveRegistryDescription(
        { description: "English", descriptionKey: "contacts.fields.firstNameDesc" },
        t,
      ),
    ).toBe("First name description");
    expect(resolveRegistryDescription({ description: "English only" }, t)).toBe("English only");
    expect(resolveRegistryDescription({}, t)).toBe("");
  });

  it("resolve*Label helpers localize defaults and known values", () => {
    expect(resolvePhoneLabel("Mobile", undefined, t)).toBe("Mobile");
    expect(resolvePhoneLabel(undefined, [], t)).toBe("Mobile");
    expect(resolveEmailLabel("Personal", undefined, t)).toBe("Personal");
    expect(resolveAddressLabel("Billing", undefined, t)).toBe("Billing");
    expect(resolveSocialPlatformLabel("Facebook", undefined, t)).toBe("Facebook");
    expect(resolveSocialPlatformLabel(undefined, [], t)).toBe("Social");
  });

  it("formatContactGenderLabel localizes gender values", () => {
    expect(formatContactGenderLabel("male", t)).toBe("Male");
    expect(formatContactGenderLabel("FEMALE", t)).toBe("Female");
  });

  it("getSyncConflictKindLabel maps kinds", () => {
    expect(getSyncConflictKindLabel("upsert", t)).toBe("Create");
    expect(getSyncConflictKindLabel("update", t)).toBe("Update");
    expect(getSyncConflictKindLabel("delete", t)).toBe("Delete");
  });

  it("getDuplicateFieldLabel maps known fields", () => {
    expect(getDuplicateFieldLabel("name", t)).toBe("Name");
    expect(getDuplicateFieldLabel("phone", t)).toBe("Phone");
    expect(getDuplicateFieldLabel("unknown", t)).toBe("unknown");
  });

  it("getFallbackCountryCode uses prefs then first configured code (no hardcoded dial)", () => {
    const map = { Pakistan: "+92", "United States": "+1" };
    const list = [
      { country: "Pakistan", code: "+92" },
      { country: "United States", code: "+1" },
    ];
    expect(getFallbackCountryCode({ defaultCountry: "United States" }, map, list)).toBe("+1");
    expect(getFallbackCountryCode({}, map, list)).toBe("+92");
    expect(getFallbackCountryCode(undefined, undefined, undefined)).toBe("");
    expect(getFallbackCountryCode({}, { Pakistan: "+92" })).toBe("+92");
  });
});

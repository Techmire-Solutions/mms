import { describe, expect, it } from "vitest";
import {
  formatContactOptionLabel,
  resolvePhoneLabel,
  resolveEmailLabel,
  resolveAddressLabel,
  resolveSocialPlatformLabel,
  resolveRegistryLabel,
  resolveRegistryDescription,
  resolveSyncFieldLabel,
} from "@/lib/contacts/contactOptionI18n";

const t = (key: string) => `[${key}]`;

describe("formatContactOptionLabel", () => {
  it("localizes a known option value", () => {
    expect(formatContactOptionLabel("male", t)).toBe("[contacts.gender.male]");
    expect(formatContactOptionLabel("Father", t)).toBe("[contacts.options.relationship.father]");
  });

  it("returns the raw value for custom options", () => {
    expect(formatContactOptionLabel("Custom Value", t)).toBe("Custom Value");
  });

  it("returns empty string for nullish input", () => {
    expect(formatContactOptionLabel(null, t)).toBe("");
    expect(formatContactOptionLabel(undefined, t)).toBe("");
  });
});

describe("resolvePhoneLabel", () => {
  it("uses the label when present", () => {
    expect(resolvePhoneLabel("Mobile", undefined, t)).toBe("[contacts.options.phone.mobile]");
  });

  it("falls back to the first phone label", () => {
    expect(resolvePhoneLabel(null, ["Home"], t)).toBe("[contacts.options.address.home]");
  });

  it("falls back to the mobile default when nothing resolves", () => {
    expect(resolvePhoneLabel(null, undefined, t)).toBe("[contacts.detail.mobileLabel]");
  });
});

describe("resolveEmailLabel", () => {
  it("uses the label when present", () => {
    expect(resolveEmailLabel("Personal", undefined, t)).toBe("[contacts.options.email.personal]");
  });

  it("falls back to the personal default", () => {
    expect(resolveEmailLabel(null, undefined, t)).toBe("[contacts.detail.personalLabel]");
  });
});

describe("resolveAddressLabel", () => {
  it("uses the label when present", () => {
    expect(resolveAddressLabel("Billing", undefined, t)).toBe("[contacts.options.address.billing]");
  });

  it("falls back to the home default", () => {
    expect(resolveAddressLabel(null, undefined, t)).toBe("[contacts.detail.homeLabel]");
  });
});

describe("resolveSocialPlatformLabel", () => {
  it("uses the platform when present", () => {
    expect(resolveSocialPlatformLabel("Facebook", undefined, t)).toBe(
      "[contacts.options.social.facebook]",
    );
  });

  it("falls back to the social default", () => {
    expect(resolveSocialPlatformLabel(null, undefined, t)).toBe("[contacts.detail.socialFallback]");
  });
});

describe("resolveRegistryLabel", () => {
  it("uses labelKey when present", () => {
    expect(resolveRegistryLabel({ label: "English", labelKey: "contacts.gender.male" }, t)).toBe(
      "[contacts.gender.male]",
    );
  });

  it("returns the English label when no labelKey", () => {
    expect(resolveRegistryLabel({ label: "Custom" }, t)).toBe("Custom");
  });
});

describe("resolveRegistryDescription", () => {
  it("uses descriptionKey when present", () => {
    expect(
      resolveRegistryDescription(
        { description: "desc", descriptionKey: "contacts.gender.male" },
        t,
      ),
    ).toBe("[contacts.gender.male]");
  });

  it("returns the description or empty string", () => {
    expect(resolveRegistryDescription({ description: "desc" }, t)).toBe("desc");
    expect(resolveRegistryDescription({}, t)).toBe("");
  });
});

describe("resolveSyncFieldLabel", () => {
  it("localizes a known sync field", () => {
    expect(resolveSyncFieldLabel("name", t)).not.toBe("name");
  });

  it("returns the raw field for unknown keys", () => {
    expect(resolveSyncFieldLabel("unknown_field", t)).toBe("unknown_field");
  });
});

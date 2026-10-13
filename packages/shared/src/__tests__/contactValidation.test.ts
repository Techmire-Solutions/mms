import { describe, it, expect } from "vitest";
import { buildDynamicContactSchema, isUrlOrSocialHandle } from "../contacts/contactValidation.js";
import { formatZodIssues } from "../contacts/contactValidationErrors.js";
import { contactWriteSchema } from "../schemas/contacts.dto.js";
import type { FieldConfig } from "../contacts/contactTypes.js";

describe("buildDynamicContactSchema", () => {
  it("should validate contact record with custom fields", () => {
    const config: FieldConfig = {
      version: 1,
      enabledTabs: ["basic", "phones"],
      requiredTabs: ["phones"],
      fields: {
        basic: [
          {
            key: "firstName",
            label: "First Name",
            type: "text",
            enabled: true,
            order: 1,
            required: true,
          },
          {
            key: "customText",
            label: "Custom Text",
            type: "text",
            enabled: true,
            order: 2,
            required: true,
            minLength: 3,
          },
        ],
        phones: [
          {
            key: "number",
            label: "Number",
            type: "text",
            enabled: true,
            order: 1,
            required: true,
          },
        ],
      },
    };

    const schema = buildDynamicContactSchema(
      config,
      new Set(config.enabledTabs),
      new Set(config.requiredTabs),
      config.fields,
      "en",
    );

    // Valid data
    const validResult = schema.safeParse({
      firstName: "John",
      customText: "Hello",
      phones: [{ number: "123456789" }],
    });
    expect(validResult.success).toBe(true);

    // Invalid data - customText too short, phones empty
    const invalidResult = schema.safeParse({
      firstName: "John",
      customText: "Hi",
      phones: [],
    });
    expect(invalidResult.success).toBe(false);
  });

  it("should support single_select and multi_select field types", () => {
    const config: FieldConfig = {
      version: 1,
      enabledTabs: ["basic"],
      requiredTabs: [],
      fields: {
        basic: [
          {
            key: "firstName",
            label: "First Name",
            type: "text",
            enabled: true,
            order: 1,
            required: true,
          },
          {
            key: "mySelect",
            label: "My Select",
            type: "single_select",
            options: ["Option A", "Option B"],
            enabled: true,
            order: 2,
            required: true,
          },
          {
            key: "myMultiSelect",
            label: "My Multi Select",
            type: "multi_select",
            options: ["X", "Y", "Z"],
            enabled: true,
            order: 3,
            required: true,
          },
        ],
      },
    };

    const schema = buildDynamicContactSchema(
      config,
      new Set(config.enabledTabs),
      new Set(config.requiredTabs),
      config.fields,
      "en",
    );

    // Valid
    const valid = schema.safeParse({
      firstName: "John",
      mySelect: "Option A",
      myMultiSelect: ["X", "Y"],
    });
    expect(valid.success).toBe(true);

    // Invalid select value
    const invalidSelect = schema.safeParse({
      firstName: "John",
      mySelect: "Option C",
      myMultiSelect: ["X"],
    });
    expect(invalidSelect.success).toBe(false);

    // Invalid multi_select value
    const invalidMulti = schema.safeParse({
      firstName: "John",
      mySelect: "Option A",
      myMultiSelect: ["W"],
    });
    expect(invalidMulti.success).toBe(false);
  });

  it("accepts social handles and URLs for url-typed fields", () => {
    const config: FieldConfig = {
      version: 1,
      enabledTabs: ["basic", "socials"],
      requiredTabs: [],
      fields: {
        basic: [
          {
            key: "firstName",
            label: "First Name",
            type: "text",
            enabled: true,
            order: 1,
            required: true,
          },
        ],
        socials: [
          {
            key: "platform",
            label: "Platform",
            type: "select",
            options: ["Facebook"],
            enabled: true,
            order: 0,
            required: false,
          },
          {
            key: "url",
            label: "Social URL / Handle",
            type: "url",
            enabled: true,
            order: 1,
            required: false,
          },
        ],
      },
    };

    const schema = buildDynamicContactSchema(
      config,
      new Set(config.enabledTabs),
      new Set(config.requiredTabs),
      config.fields,
      "en",
    );

    expect(
      schema.safeParse({
        firstName: "John",
        socials: [{ platform: "Facebook", url: "@madrasa" }],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        firstName: "John",
        socials: [{ platform: "Facebook", url: "https://instagram.com/a" }],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        firstName: "John",
        socials: [{ platform: "Facebook", url: "not a handle" }],
      }).success,
    ).toBe(false);
  });
});

describe("isUrlOrSocialHandle", () => {
  it("accepts urls, domains, and handles", () => {
    expect(isUrlOrSocialHandle("")).toBe(true);
    expect(isUrlOrSocialHandle("https://x.com/a")).toBe(true);
    expect(isUrlOrSocialHandle("instagram.com/user")).toBe(true);
    expect(isUrlOrSocialHandle("@user_name")).toBe(true);
    expect(isUrlOrSocialHandle("username")).toBe(true);
    expect(isUrlOrSocialHandle("bad value")).toBe(false);
  });
});

describe("buildDynamicContactSchema Setup Fields round-trip", () => {
  it("skips disabled required fields and still requires enabled ones", () => {
    const config: FieldConfig = {
      version: 1,
      enabledTabs: ["basic"],
      requiredTabs: [],
      fields: {
        basic: [
          {
            key: "firstName",
            label: "First Name",
            type: "text",
            enabled: true,
            order: 1,
            required: true,
          },
          {
            key: "hiddenRequired",
            label: "Hidden",
            type: "text",
            enabled: false,
            order: 2,
            required: true,
          },
          {
            key: "visibleRequired",
            label: "Visible Required",
            type: "text",
            enabled: true,
            order: 3,
            required: true,
          },
        ],
      },
    };

    const schema = buildDynamicContactSchema(
      config,
      new Set(config.enabledTabs),
      new Set(config.requiredTabs),
      config.fields,
      "en",
    );

    expect(
      schema.safeParse({
        firstName: "John",
        visibleRequired: "ok",
      }).success,
    ).toBe(true);

    expect(
      schema.safeParse({
        firstName: "John",
        visibleRequired: "",
      }).success,
    ).toBe(false);

    // Disabled required field must not gate the payload.
    expect(
      schema.safeParse({
        firstName: "John",
        visibleRequired: "ok",
        hiddenRequired: "",
      }).success,
    ).toBe(true);
  });

  describe("formatZodIssues tab mapping", () => {
    it("correctly maps bankDetails, education, experience, skills, and relationships errors to their respective tabs", () => {
      const invalidPayload = {
        firstName: "John",
        bankDetails: [{ bankName: 123 as unknown as string }],
        education: [{ institution: 123 as unknown as string }],
        experience: [{ title: 123 as unknown as string }],
        skills: [{ name: 123 as unknown as string }],
        relationships: [{ relatedContactId: 123 as unknown as string }],
      };

      const result = contactWriteSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = formatZodIssues(result.error, invalidPayload, {}, "en");
        const tabIds = new Set(errors.map((e) => e.tabId));
        expect(tabIds.has("bankDetails")).toBe(true);
        expect(tabIds.has("education")).toBe(true);
        expect(tabIds.has("experience")).toBe(true);
        expect(tabIds.has("skills")).toBe(true);
        expect(tabIds.has("relationship")).toBe(true);
        expect(tabIds.has("basic")).toBe(false);
      }
    });
  });
});

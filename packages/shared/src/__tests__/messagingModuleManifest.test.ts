import { describe, expect, it } from "vitest";
import {
  MESSAGING_MODULE_MANIFEST,
  MESSAGING_ROLE_OPTIONS,
  MESSAGING_GENDER_OPTIONS,
  MESSAGING_STATUS_OPTIONS,
  getChannelBadgeStyle,
  getChannelLabelKey,
  getMessageCategoryLabelKey,
  toMessagingRecipient,
  messagingResolveResponseSchema,
} from "../messaging/messagingModuleManifest.js";

describe("messagingModuleManifest", () => {
  it("defines the correct module manifest metadata and tiers", () => {
    expect(MESSAGING_MODULE_MANIFEST.moduleId).toBe("messaging");
    expect(MESSAGING_MODULE_MANIFEST.entityType).toBe("Message");
    expect(MESSAGING_MODULE_MANIFEST.restBasePath).toBe("/api/messaging");
    expect(MESSAGING_MODULE_MANIFEST.tiers).toEqual(["work", "reports", "setup"]);
    expect(MESSAGING_MODULE_MANIFEST.setupSubTabs).toEqual(["templates", "preferences"]);
    expect(MESSAGING_MODULE_MANIFEST.preferencesObjectKey).toBe("messaging_preferences");
    expect(MESSAGING_MODULE_MANIFEST.softDelete.workExcludesDeleted).toBe(true);
    expect(MESSAGING_MODULE_MANIFEST.permissions.read).toBe("messaging.read");
    expect(MESSAGING_MODULE_MANIFEST.permissions.write).toBe("messaging.write");
    expect(MESSAGING_MODULE_MANIFEST.permissions.clearLogs).toBe("messaging.clearLogs");
    expect(MESSAGING_MODULE_MANIFEST.permissions.restoreLogs).toBe("messaging.restoreLogs");
    expect(MESSAGING_MODULE_MANIFEST.recipientsColumnPreferencesObjectKey).toBe(
      "messaging_recipients_user_column_preferences",
    );
    expect(MESSAGING_MODULE_MANIFEST.historyColumnPreferencesObjectKey).toBe(
      "messaging_history_user_column_preferences",
    );
    expect(MESSAGING_MODULE_MANIFEST.templatesColumnPreferencesObjectKey).toBe(
      "messaging_templates_user_column_preferences",
    );
  });

  it("contains expected contract options mapping to i18n keys", () => {
    expect(MESSAGING_ROLE_OPTIONS).toEqual(
      expect.arrayContaining([
        { value: "all", labelKey: "messaging.role.all" },
        { value: "students", labelKey: "messaging.role.students" },
        { value: "faculty", labelKey: "messaging.role.faculty" },
      ]),
    );

    expect(MESSAGING_GENDER_OPTIONS).toEqual(
      expect.arrayContaining([
        { value: "all", labelKey: "messaging.gender.all" },
        { value: "male", labelKey: "messaging.gender.male" },
      ]),
    );

    expect(MESSAGING_STATUS_OPTIONS).toEqual(
      expect.arrayContaining([
        { value: "all", labelKey: "messaging.status.all" },
        { value: "sent", labelKey: "messaging.status.sent" },
        { value: "delivered", labelKey: "messaging.status.delivered" },
      ]),
    );
  });

  it("resolves correct badge style for channel types", () => {
    expect(getChannelBadgeStyle("email")).toContain("text-warning");
    expect(getChannelBadgeStyle("sms")).toContain("text-info");
    expect(getChannelBadgeStyle("whatsapp")).toContain("text-success");
    expect(getChannelBadgeStyle("unknown")).toContain("text-success");
  });

  it("returns appropriate i18n label keys for channels and categories", () => {
    expect(getChannelLabelKey("sms")).toBe("messaging.channel.sms");
    expect(getChannelLabelKey("whatsapp")).toBe("messaging.channel.whatsapp");
    expect(getMessageCategoryLabelKey("general")).toBe("messaging.category.general");
    expect(getMessageCategoryLabelKey("academic")).toBe("messaging.category.academic");
  });

  it("converts objects into standardized messaging recipients via toMessagingRecipient", () => {
    const rawContact = {
      id: 101,
      name: "Aisha Ahmed",
      phone: "+923001234567",
      email: "aisha@example.com",
    };
    const converted = toMessagingRecipient(rawContact, {
      getDisplayName: (c) => c.name,
      getPrimaryPhone: (c) => c.phone,
      getPrimaryEmail: (c) => c.email,
    });

    expect(converted).toEqual({
      id: 101,
      name: "Aisha Ahmed",
      phone: "+923001234567",
      email: "aisha@example.com",
    });
  });

  it("parses lean resolve response via messagingResolveResponseSchema", () => {
    const parsed = messagingResolveResponseSchema.parse({
      recipients: [{ id: "c1", name: "Ali", phone: "+923001111111", email: "ali@example.com" }],
    });
    expect(parsed.recipients).toHaveLength(1);
    expect(parsed.recipients[0]?.name).toBe("Ali");
  });
});

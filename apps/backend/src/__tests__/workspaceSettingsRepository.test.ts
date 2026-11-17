import { describe, expect, it } from "vitest";
import { rowToGlobalSettings } from "../db/repositories/workspaceSettingsRepository.js";

describe("rowToGlobalSettings", () => {
  it("maps whatsAppNotifications from the typed column", () => {
    const settings = rowToGlobalSettings({ whatsAppNotifications: true } as never);
    expect(settings.whatsAppNotifications).toBe(true);
  });

  it("defaults whatsAppNotifications to false when the column is null", () => {
    const settings = rowToGlobalSettings({ whatsAppNotifications: null } as never);
    expect(settings.whatsAppNotifications).toBe(false);
  });

  it("still merges the remaining global-settings defaults", () => {
    const settings = rowToGlobalSettings({ whatsAppNotifications: true } as never);
    expect(settings.language).toBe("en");
    expect(settings.theme).toBe("system");
    expect(settings.passwordPolicy).toBe("strong");
  });
});

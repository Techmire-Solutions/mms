import { describe, expect, it } from "vitest";
import { requiresTwoFactor } from "../settings/globalSettingsNotificationUtils.js";
import { DEFAULT_GLOBAL_SETTINGS } from "../settings/globalSettingsTypes.js";

const twoFactorOn = { ...DEFAULT_GLOBAL_SETTINGS, twoFactor: true };
const twoFactorOff = { ...DEFAULT_GLOBAL_SETTINGS, twoFactor: false };

describe("requiresTwoFactor", () => {
  it("returns false without a user", () => {
    expect(requiresTwoFactor(twoFactorOn, null)).toBe(false);
  });

  it("honours the per-user flag regardless of role and workspace setting", () => {
    expect(requiresTwoFactor(twoFactorOff, { role: "teacher", twoFactorEnabled: true })).toBe(true);
  });

  it("enforces workspace 2FA for every administrative role", () => {
    for (const role of ["admin", "super_admin", "super_user"]) {
      expect(requiresTwoFactor(twoFactorOn, { role })).toBe(true);
    }
  });

  it("does not enforce workspace 2FA for non-administrative roles", () => {
    for (const role of ["teacher", "accountant", "librarian"]) {
      expect(requiresTwoFactor(twoFactorOn, { role })).toBe(false);
    }
  });
});

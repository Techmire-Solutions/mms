import { describe, expect, it } from "vitest";
import {
  platformSetupRegisterBodySchema,
  platformPasswordResetBodySchema,
  platformCreateAdminBodySchema,
  platformChangePasswordBodySchema,
} from "../schemas/platform.dto.js";
import { PLATFORM_MIN_PASSWORD_LENGTH } from "../auth/platformTypes.js";

describe("platformSchemas", () => {
  it("validates platform setup registration input", () => {
    const valid = platformSetupRegisterBodySchema.safeParse({
      name: "Super Admin",
      email: "admin@madrasa.org",
      password: "StrongPassword123!",
    });
    expect(valid.success).toBe(true);

    const invalidPassword = platformSetupRegisterBodySchema.safeParse({
      name: "Super Admin",
      email: "admin@madrasa.org",
      password: "short",
    });
    expect(invalidPassword.success).toBe(false);
  });

  it("validates platform password reset input", () => {
    const valid = platformPasswordResetBodySchema.safeParse({
      resetId: "reset-session-123",
      code: "123456",
      password: "NewStrongPassword123!",
    });
    expect(valid.success).toBe(true);

    const invalidCode = platformPasswordResetBodySchema.safeParse({
      resetId: "reset-session-123",
      code: "12",
      password: "NewStrongPassword123!",
    });
    expect(invalidCode.success).toBe(false);
  });

  it("validates admin creation input with minimum password length", () => {
    const valid = platformCreateAdminBodySchema.safeParse({
      name: "Admin User",
      email: "admin2@madrasa.org",
      password: "Password123456",
      currentPassword: "OperatorPass123",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.permissions).toEqual({
        workspaces: false,
        onboard: false,
        settings: false,
        admins: false,
        system: false,
      });
    }
    expect(PLATFORM_MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(10);
  });

  it("validates password change input", () => {
    const valid = platformChangePasswordBodySchema.safeParse({
      currentPassword: "OldPassword123",
      newPassword: "NewPassword12345",
    });
    expect(valid.success).toBe(true);
  });
});

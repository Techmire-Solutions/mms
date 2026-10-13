import { describe, expect, it } from "vitest";
import { normalizeWorkspaceUser } from "../auth/userTypes.js";

describe("normalizeWorkspaceUser", () => {
  it("falls back to loginEmail when email is empty", () => {
    const user = normalizeWorkspaceUser({
      id: "u1",
      name: "John Doe",
      email: "",
      loginEmail: "john.doe.e2e@example.com",
      phone: "",
      role: "teacher",
      status: "inactive",
      twoFactorEnabled: false,
      lastLogin: "",
      createdDate: "2026-01-01",
      failedLoginAttempts: 0,
      activeSessions: 0,
      avatarInitials: "JD",
    });
    expect(user.email).toBe("john.doe.e2e@example.com");
    expect(user.name).toBe("John Doe");
  });

  it("treats blank name as missing and falls back to email", () => {
    const user = normalizeWorkspaceUser({
      id: "u1",
      name: "   ",
      email: "",
      loginEmail: "teacher@example.com",
      phone: "",
      role: "teacher",
      status: "inactive",
      twoFactorEnabled: false,
      lastLogin: "",
      createdDate: "2026-01-01",
      failedLoginAttempts: 0,
      activeSessions: 0,
      avatarInitials: "",
    });
    expect(user.name).toBe("teacher@example.com");
    expect(user.email).toBe("teacher@example.com");
  });
});

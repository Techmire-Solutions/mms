import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  AUTH_USER_STORAGE_KEY,
  AuthFailureError,
  buildConnectionAuthError,
  clearPersistedAuthUser,
  clearUserScopedCachesOnLogout,
  getPersistedAuthUser,
  persistAuthUser,
} from "./authContextHelpers";
import type { User } from "@mms/shared";

let mockIsApex = false;
let mockSubdomain: string | null = "test";

vi.mock("@/lib/config/tenantConfig", () => ({
  isCurrentHostApex: () => mockIsApex,
  getCurrentSubdomain: () => mockSubdomain,
}));

describe("authContextHelpers", () => {
  beforeEach(() => {
    localStorage.clear();
    mockIsApex = false;
    mockSubdomain = "test";
    vi.clearAllMocks();
  });

  describe("AuthFailureError", () => {
    it("initializes with authError and sets message and name", () => {
      const err = new AuthFailureError({ type: "invalid_credentials", message: "Bad password" });
      expect(err.name).toBe("AuthFailureError");
      expect(err.message).toBe("Bad password");
      expect(err.authError.type).toBe("invalid_credentials");
    });
  });

  describe("buildConnectionAuthError", () => {
    it("extracts message from Error instance", () => {
      const authErr = buildConnectionAuthError(new Error("Network disconnected"));
      expect(authErr.type).toBe("connection_error");
      expect(authErr.message).toBe("Network disconnected");
    });

    it("falls back to default message for non-Error input", () => {
      const authErr = buildConnectionAuthError("some-string");
      expect(authErr.type).toBe("connection_error");
      expect(authErr.message).toBe("Failed to connect to authentication server");
    });
  });

  describe("clearUserScopedCachesOnLogout", () => {
    it("removes messages and whatsappTemplates from localStorage", () => {
      localStorage.setItem("tenant_messages", "[]");
      localStorage.setItem("tenant_whatsappTemplates_u:u123", "[]");

      clearUserScopedCachesOnLogout("u123", "tenant_");

      expect(localStorage.getItem("tenant_messages")).toBeNull();
      expect(localStorage.getItem("tenant_whatsappTemplates_u:u123")).toBeNull();
    });
  });

  describe("PersistedAuthUser", () => {
    const createTestUser = (overrides?: Partial<User>): User => ({
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      role: "admin",
      workspaceSubdomain: "test",
      ...overrides,
    });

    it("persists and retrieves user from localStorage", () => {
      const user = createTestUser();
      persistAuthUser(user);
      expect(localStorage.getItem(AUTH_USER_STORAGE_KEY)).not.toBeNull();

      const retrieved = getPersistedAuthUser();
      expect(retrieved?.id).toBe("u1");
      expect(retrieved?.email).toBe("test@example.com");
    });

    it("clears persisted user from localStorage", () => {
      const user = createTestUser();
      persistAuthUser(user);
      clearPersistedAuthUser();
      expect(localStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
      expect(getPersistedAuthUser()).toBeNull();
    });

    it("returns null if stored value is invalid JSON or missing id", () => {
      localStorage.setItem(AUTH_USER_STORAGE_KEY, "not-json");
      expect(getPersistedAuthUser()).toBeNull();

      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify({ name: "No ID" }));
      expect(getPersistedAuthUser()).toBeNull();
    });

    it("returns null if host is apex", () => {
      mockIsApex = true;
      const user = createTestUser();
      persistAuthUser(user);

      expect(getPersistedAuthUser()).toBeNull();
    });

    it("evicts and returns null if workspaceSubdomain does not match current host subdomain", () => {
      mockSubdomain = "other-tenant";
      const user = createTestUser({ workspaceSubdomain: "my-tenant" });
      persistAuthUser(user);

      expect(getPersistedAuthUser()).toBeNull();
      expect(localStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
    });
  });
});

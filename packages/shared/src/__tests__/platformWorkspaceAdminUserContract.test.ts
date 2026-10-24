import { describe, expect, it } from "vitest";
import { platformWorkspacesRoutes } from "../contracts/platform.contract.js";

describe("platformWorkspacesRoutes.createWorkspaceAdminUser contract", () => {
  it("validates request path params and body schemas", () => {
    const route = platformWorkspacesRoutes.createWorkspaceAdminUser;
    expect(route.method).toBe("POST");
    expect(route.path).toBe("/api/platform/workspaces/:subdomain/admin-users");

    const validBody = route.body.safeParse({
      name: "Administrator",
      email: "admin@subdomain.org",
      password: "StrongPassword123",
      currentPassword: "PlatformOperatorPass1",
    });
    expect(validBody.success).toBe(true);

    const validBodyNoPassword = route.body.safeParse({
      name: "Administrator",
      email: "admin@subdomain.org",
      currentPassword: "PlatformOperatorPass1",
    });
    expect(validBodyNoPassword.success).toBe(true);

    const missingStepUp = route.body.safeParse({
      name: "Administrator",
      email: "admin@subdomain.org",
    });
    expect(missingStepUp.success).toBe(false);

    const invalidEmail = route.body.safeParse({
      name: "Administrator",
      email: "invalid-email",
      currentPassword: "PlatformOperatorPass1",
    });
    expect(invalidEmail.success).toBe(false);

    const shortPassword = route.body.safeParse({
      name: "Administrator",
      email: "admin@subdomain.org",
      password: "short",
      currentPassword: "PlatformOperatorPass1",
    });
    expect(shortPassword.success).toBe(false);
  });

  it("validates 200 response schema shape", () => {
    const response200Schema = platformWorkspacesRoutes.createWorkspaceAdminUser.responses[200];
    const validResponse = response200Schema.safeParse({
      success: true,
      subdomain: "demo",
      adminEmail: "admin@subdomain.org",
      name: "Administrator",
      initialPassword: "Mms#RandomPass123",
    });
    expect(validResponse.success).toBe(true);
  });
});

describe("platformWorkspacesRoutes.resetWorkspaceAdminPassword contract", () => {
  it("requires platform password step-up", () => {
    const route = platformWorkspacesRoutes.resetWorkspaceAdminPassword;
    expect(route.body.safeParse({ password: "OperatorPass1" }).success).toBe(true);
    expect(
      route.body.safeParse({ password: "OperatorPass1", newPassword: "NewAdminPass1" }).success,
    ).toBe(true);
    expect(route.body.safeParse({ newPassword: "NewAdminPass1" }).success).toBe(false);
    expect(route.body.safeParse({}).success).toBe(false);
  });
});

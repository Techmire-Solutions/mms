import { describe, expect, it } from "vitest";
import { onboardBodySchema } from "../schemas/auth.dto.js";
import { platformWorkspaceRowDtoSchema } from "../schemas/platform.dto.js";
import { workspaceRenameBodySchema } from "../schemas/platformManagement.dto.js";
import { platformWorkspacesRoutes } from "../contracts/platform.contract.js";

const validOnboardPayload = {
  madrasaName: "Dar ul Quran",
  adminName: "Ali Raza",
  email: "admin@darulquran.test",
  adminGender: "male" as const,
  adminPasswordMode: "email" as const,
  currentPassword: "operator-step-up",
  subdomain: "darulquran",
};

describe("onboardBodySchema", () => {
  it("accepts an onboarding payload that carries the admin gender", () => {
    expect(onboardBodySchema.safeParse(validOnboardPayload).success).toBe(true);
    expect(
      onboardBodySchema.safeParse({ ...validOnboardPayload, adminGender: "female" }).success,
    ).toBe(true);
  });

  it("rejects a payload without a gender (platform-created madrasas must collect it)", () => {
    const { adminGender: _adminGender, ...withoutGender } = validOnboardPayload;
    expect(onboardBodySchema.safeParse(withoutGender).success).toBe(false);
  });

  it("rejects a gender outside the tenant contact lookup values", () => {
    expect(
      onboardBodySchema.safeParse({ ...validOnboardPayload, adminGender: "other" }).success,
    ).toBe(false);
  });

  it("requires an explicit super-admin password mode", () => {
    const { adminPasswordMode: _mode, ...withoutMode } = validOnboardPayload;
    expect(onboardBodySchema.safeParse(withoutMode).success).toBe(false);
    expect(
      onboardBodySchema.safeParse({ ...validOnboardPayload, adminPasswordMode: "auto" }).success,
    ).toBe(false);
  });

  it("requires a password in temporary mode", () => {
    expect(
      onboardBodySchema.safeParse({
        ...validOnboardPayload,
        adminPasswordMode: "temporary",
      }).success,
    ).toBe(false);
    expect(
      onboardBodySchema.safeParse({
        ...validOnboardPayload,
        adminPasswordMode: "temporary",
        password: "   ",
      }).success,
    ).toBe(false);
    expect(
      onboardBodySchema.safeParse({
        ...validOnboardPayload,
        adminPasswordMode: "temporary",
        password: "TempPassword123!",
      }).success,
    ).toBe(true);
  });

  it("rejects a password in email-activation mode", () => {
    expect(
      onboardBodySchema.safeParse({
        ...validOnboardPayload,
        adminPasswordMode: "email",
        password: "TempPassword123!",
      }).success,
    ).toBe(false);
  });

  it("rejects a legacy terms-of-service field (removed for platform-created tenants)", () => {
    expect(onboardBodySchema.safeParse({ ...validOnboardPayload, agreedTerms: true }).success).toBe(
      false,
    );
  });
});

describe("workspaceRenameBodySchema", () => {
  it("accepts a trimmed, non-empty madrasa name", () => {
    expect(workspaceRenameBodySchema.safeParse({ madrasaName: "  Al-Noor Academy " }).success).toBe(
      true,
    );
  });

  it("rejects empty, blank and over-long names", () => {
    expect(workspaceRenameBodySchema.safeParse({ madrasaName: "" }).success).toBe(false);
    expect(workspaceRenameBodySchema.safeParse({ madrasaName: "   " }).success).toBe(false);
    expect(workspaceRenameBodySchema.safeParse({ madrasaName: "x".repeat(61) }).success).toBe(
      false,
    );
  });

  it("rejects unknown keys", () => {
    expect(
      workspaceRenameBodySchema.safeParse({ madrasaName: "Al-Noor", subdomain: "al-noor" }).success,
    ).toBe(false);
  });
});

describe("platformWorkspaceRowDtoSchema", () => {
  it("accepts the provisioning admin identity fields", () => {
    const parsed = platformWorkspaceRowDtoSchema.safeParse({
      subdomain: "al-noor",
      madrasaName: "Al-Noor Academy",
      enabled: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      adminEmail: "admin@alnoor.test",
      adminName: "Ali Raza",
      adminGender: "male",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("platformWorkspacesRoutes.renameWorkspace contract", () => {
  it("declares the platform-only rename route", () => {
    const route = platformWorkspacesRoutes.renameWorkspace;
    expect(route.method).toBe("PATCH");
    expect(route.path).toBe("/api/platform/workspaces/:subdomain/name");
    expect(route.body).toBe(workspaceRenameBodySchema);
    expect(route.responses[200]).toBeDefined();
    expect(route.responses[404]).toBeDefined();
  });
});

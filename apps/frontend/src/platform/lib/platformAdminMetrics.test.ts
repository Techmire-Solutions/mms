import { describe, expect, it } from "vitest";
import { DEFAULT_PLATFORM_ADMIN_PERMISSIONS, type PlatformUserProfile } from "@mms/shared";
import { getPlatformAdminMetrics } from "./platformAdminMetrics";

describe("operator metrics", () => {
  it("does not report full verification for an empty directory", () => {
    expect(getPlatformAdminMetrics([])).toMatchObject({ total: 0, active: 0, verifiedPct: 0 });
  });
  it("counts roles, disabled accounts, and verification independently", () => {
    const operator: PlatformUserProfile = {
      id: "1",
      name: "Operator",
      email: "operator@example.com",
      role: "admin",
      permissions: DEFAULT_PLATFORM_ADMIN_PERMISSIONS,
    };
    expect(
      getPlatformAdminMetrics([
        operator,
        { ...operator, id: "2", role: "super_user", emailVerifiedAt: "2026-09-30" },
        { ...operator, id: "3", disabledAt: "2026-09-30" },
      ]),
    ).toEqual({
      total: 3,
      active: 2,
      disabled: 1,
      superUsers: 1,
      standardAdmins: 2,
      verified: 1,
      verifiedPct: 33,
    });
  });
});

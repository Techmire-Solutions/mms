import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformReportsOperatorCard } from "./PlatformReportsOperatorCard";
import { FULL_PLATFORM_ADMIN_PERMISSIONS, type PlatformUser } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockUser: PlatformUser = {
  id: "usr-1",
  name: "Platform Operator",
  email: "op@mms.platform",
  role: "super_user",
  permissions: FULL_PLATFORM_ADMIN_PERMISSIONS,
};

describe("PlatformReportsOperatorCard Component", () => {
  it("renders operator card with user identity, super user role, and capability badges", () => {
    const html = renderToStaticMarkup(
      <PlatformReportsOperatorCard
        platformUser={mockUser}
        isSuperUser={true}
        canWorkspaces={true}
        canOnboard={true}
        canSettings={true}
        canAdmins={true}
        canSystem={true}
      />,
    );

    expect(html).toContain("Platform Operator");
    expect(html).toContain("op@mms.platform");
    expect(html).toContain("platform.operatorIdentityTitle");
    expect(html).toContain("platform.roleSuperUser");
    expect(html).toContain("platform.capabilitiesLabel");
    expect(html).toContain("platform.manageMadrasas");
    expect(html).toContain("platform.onboardCapability");
  });
});

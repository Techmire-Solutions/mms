import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformUsersSetupTier } from "@/platform/features/users/components/PlatformUsersSetupTier";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@/platform/features/users/components/PlatformPermissionMatrix", () => ({
  PlatformPermissionMatrix: () => <div data-testid="permission-matrix">Permission Matrix</div>,
}));

describe("PlatformUsersSetupTier", () => {
  it("given setup tier, should render permissions matrix only without security preferences", () => {
    const html = renderToStaticMarkup(<PlatformUsersSetupTier />);

    expect(html).toContain("Permission Matrix");
    expect(html).not.toContain("users.setup.preferences");
    expect(html).not.toContain("Security Panel");
  });
});

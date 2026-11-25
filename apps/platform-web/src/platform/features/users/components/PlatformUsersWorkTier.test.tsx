import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformUsersWorkTier } from "@/platform/features/users/components/PlatformUsersWorkTier";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@/platform/features/users/hooks/usePlatformAdmins", () => ({
  usePlatformAdmins: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/platform/features/users/components/PlatformAdminsList", () => ({
  PlatformAdminsList: () => <div data-testid="admins-list">Operators List</div>,
}));

vi.mock("@/platform/features/users/components/PlatformIamPanel", () => ({
  PlatformIamPanel: () => <div data-testid="platform-iam-panel">IAM Panel</div>,
}));

describe("PlatformUsersWorkTier", () => {
  it("given operators data, should render operators directory without activity subtabs", () => {
    const html = renderToStaticMarkup(<PlatformUsersWorkTier />);

    expect(html).toContain("Operators List");
    expect(html).not.toContain("platform.activityLogsTitle");
  });
});

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformUsersWorkTier } from "./PlatformUsersWorkTier";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@/platform/hooks/usePlatformAdmins", () => ({
  usePlatformAdmins: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/platform/pages/PlatformAdminsList", () => ({
  PlatformAdminsList: () => <div data-testid="admins-list">Operators List</div>,
}));

describe("PlatformUsersWorkTier", () => {
  it("given operators data, should render operators directory without activity subtabs", () => {
    const html = renderToStaticMarkup(<PlatformUsersWorkTier />);

    expect(html).toContain("Operators List");
    expect(html).not.toContain("platform.activityLogsTitle");
  });
});

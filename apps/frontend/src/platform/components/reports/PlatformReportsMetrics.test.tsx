import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformReportsMetrics } from "./PlatformReportsMetrics";
import { FULL_PLATFORM_ADMIN_PERMISSIONS } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("PlatformReportsMetrics Component", () => {
  it("renders command metrics grid when data is ready", () => {
    const html = renderToStaticMarkup(
      <PlatformReportsMetrics
        totalWorkspaces={10}
        activeWorkspaces={8}
        activeRate={80}
        platformUser={{
          id: "1",
          name: "Alice Operator",
          email: "a@mms.local",
          role: "super_user",
          permissions: FULL_PLATFORM_ADMIN_PERMISSIONS,
        }}
        isReady={true}
        isError={false}
      />,
    );

    expect(html).toContain("8 / 10");
    expect(html).toContain("80%");
    expect(html).toContain("Alice Operator");
    expect(html).toContain("platform.workspaceActive");
    expect(html).toContain("platform.activationRate");
  });

  it("returns null when error state occurs", () => {
    const html = renderToStaticMarkup(
      <PlatformReportsMetrics
        totalWorkspaces={0}
        activeWorkspaces={0}
        activeRate={0}
        isReady={false}
        isError={true}
      />,
    );

    expect(html).toBe("");
  });
});

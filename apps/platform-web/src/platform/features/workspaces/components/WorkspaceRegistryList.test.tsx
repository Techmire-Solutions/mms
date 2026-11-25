import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import WorkspaceRegistryList from "@/platform/features/workspaces/components/WorkspaceRegistryList";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

vi.mock("@/platform/features/workspaces/hooks/useWorkspaceRegistry", () => ({
  useWorkspaceRegistry: () => ({
    data: [
      {
        subdomain: "demo",
        madrasaName: "Demo Madrasa",
        logoUrl: null,
        tagline: "Excellence in learning",
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("WorkspaceRegistryList", () => {
  it("renders workspace card with start-edge accent stripe and inset", () => {
    const html = renderToStaticMarkup(<WorkspaceRegistryList />);

    expect(html).toContain("relative overflow-hidden group/card");
    expect(html).toContain("ps-5 sm:ps-6");
    expect(html).toContain("absolute inset-y-0 start-0 w-1.5");
    expect(html).toContain("bg-primary/50 group-hover/card:bg-primary");
    expect(html).toContain("Demo Madrasa");
  });
});

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceListCards } from "./WorkspaceListCards";
import type { PlatformWorkspaceRow } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockWorkspaces: PlatformWorkspaceRow[] = [
  {
    subdomain: "al-huda",
    madrasaName: "Al Huda Academy",
    enabled: true,
    requireEmailVerification: true,
    createdAt: "2025-01-01T00:00:00Z",
  },
];

describe("WorkspaceListCards Component", () => {
  it("renders workspace cards grid with workspace details via WorkspaceListCards", () => {
    const html = renderToStaticMarkup(
      <WorkspaceListCards
        workspaces={mockWorkspaces}
        appDomain="mms.local"
        togglePending={false}
        deletePending={false}
        onToggleEnabled={vi.fn()}
        onToggleEmailVerification={vi.fn()}
        onOpenModules={vi.fn()}
        onOpenDelete={vi.fn()}
      />,
    );

    expect(html).toContain("al-huda");
    expect(html).toContain("Al Huda Academy");
    expect(html).toContain("platform.sort.createdAt");
  });
});

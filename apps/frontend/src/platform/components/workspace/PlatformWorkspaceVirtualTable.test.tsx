import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import type { PlatformWorkspaceRow } from "@mms/shared";
import { PlatformWorkspaceVirtualTable } from "./PlatformWorkspaceVirtualTable";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockDescriptor = {
  getTableColumns: () => [
    { id: "madrasaName", label: "Madrasa Name" },
    { id: "enabled", label: "Status" },
    { id: "createdAt", label: "Created" },
  ],
  getField: (id: string) => ({ id, label: id }),
} as unknown as Parameters<typeof PlatformWorkspaceVirtualTable>[0]["descriptor"];

const mockWorkspaces: PlatformWorkspaceRow[] = [
  {
    subdomain: "demo",
    madrasaName: "Demo Madrasa",
    enabled: true,
    requireEmailVerification: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
];

describe("PlatformWorkspaceVirtualTable", () => {
  it("renders virtual table with given workspaces and density", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <PlatformWorkspaceVirtualTable
          workspaces={mockWorkspaces}
          descriptor={mockDescriptor}
          appDomain="mms.test"
          density="compact"
          sortField="name"
          sortDirection="asc"
          onToggleSort={vi.fn()}
          togglePending={false}
          deletePending={false}
          onToggleEnabled={vi.fn()}
          onToggleEmailVerification={vi.fn()}
          onOpenModules={vi.fn()}
          onOpenDelete={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("Demo Madrasa");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

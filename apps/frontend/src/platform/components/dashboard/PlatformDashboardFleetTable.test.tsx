import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { PlatformWorkspaceRow } from "@mms/shared";
import { PlatformDashboardFleetTable } from "./PlatformDashboardFleetTable";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const openInspectorMock = vi.fn();
vi.mock("@/platform/lib/PlatformInspectorContext", () => ({
  usePlatformInspector: () => ({
    target: null,
    openInspector: openInspectorMock,
    closeInspector: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
  }),
}));

const mockRows: PlatformWorkspaceRow[] = [
  {
    subdomain: "al-noor",
    madrasaName: "Al-Noor Academy",
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    adminEmail: "admin@alnoor.test",
  },
  {
    subdomain: "dar-ul-uloom",
    madrasaName: "جامعة دار العلوم",
    enabled: false,
    createdAt: "2026-01-02T00:00:00.000Z",
    adminEmail: "admin@daruloom.test",
  },
];

describe("PlatformDashboardFleetTable", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    openInspectorMock.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders workspace names and subdomains with dir=auto BiDiText", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlatformDashboardFleetTable
            rows={mockRows}
            total={2}
            page={1}
            pageSize={10}
            isLoading={false}
            selected={new Set()}
            onToggleSelect={vi.fn()}
            onToggleSelectAll={vi.fn()}
            onPageChange={vi.fn()}
            sortDir="asc"
            onToggleSort={vi.fn()}
            onRequestExport={vi.fn()}
          />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Al-Noor Academy");
    expect(container.textContent).toContain("al-noor");
    expect(container.textContent).toContain("جامعة دار العلوم");
    expect(container.textContent).toContain("dar-ul-uloom");

    const bidiElements = container.querySelectorAll('[dir="auto"]');
    expect(bidiElements.length).toBeGreaterThanOrEqual(2);
  });

  it("renders empty state when rows array is empty", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlatformDashboardFleetTable
            rows={[]}
            total={0}
            page={1}
            pageSize={10}
            isLoading={false}
            selected={new Set()}
            onToggleSelect={vi.fn()}
            onToggleSelectAll={vi.fn()}
            onPageChange={vi.fn()}
            sortDir="asc"
            onToggleSort={vi.fn()}
            onRequestExport={vi.fn()}
          />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("platform.fleetEmptyTitle");
  });

  it("renders export button when items are selected and responds to clicks", async () => {
    const onRequestExport = vi.fn();
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlatformDashboardFleetTable
            rows={mockRows}
            total={2}
            page={1}
            pageSize={10}
            isLoading={false}
            selected={new Set(["al-noor"])}
            onToggleSelect={vi.fn()}
            onToggleSelectAll={vi.fn()}
            onPageChange={vi.fn()}
            sortDir="asc"
            onToggleSort={vi.fn()}
            onRequestExport={onRequestExport}
          />
        </MemoryRouter>,
      );
    });

    const exportBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("platform.workspaces.exportSelected"),
    );
    expect(exportBtn instanceof HTMLButtonElement).toBe(true);

    await act(async () => {
      exportBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRequestExport).toHaveBeenCalledTimes(1);
  });

  it("invokes openInspector when a row is clicked", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlatformDashboardFleetTable
            rows={mockRows}
            total={2}
            page={1}
            pageSize={10}
            isLoading={false}
            selected={new Set()}
            onToggleSelect={vi.fn()}
            onToggleSelectAll={vi.fn()}
            onPageChange={vi.fn()}
            sortDir="asc"
            onToggleSort={vi.fn()}
            onRequestExport={vi.fn()}
          />
        </MemoryRouter>,
      );
    });

    const nameCell = Array.from(container.querySelectorAll("p")).find((p) =>
      p.textContent?.includes("Al-Noor Academy"),
    );
    const row = nameCell?.closest("tr");
    expect(row instanceof HTMLTableRowElement).toBe(true);

    await act(async () => {
      row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(openInspectorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "workspace",
        subdomain: "al-noor",
        madrasaName: "Al-Noor Academy",
      }),
    );
  });
});

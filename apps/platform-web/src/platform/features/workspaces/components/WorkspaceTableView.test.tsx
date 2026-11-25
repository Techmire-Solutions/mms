import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlatformWorkspaceRow } from "@mms/contracts";
import { platformWorkspacesEntityDescriptor } from "@/components/common/descriptors/platformDescriptors";
import { WorkspaceTableView } from "@/platform/features/workspaces/components/WorkspaceTableView";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    isRtl: false,
  }),
}));

const sampleWorkspace: PlatformWorkspaceRow = {
  subdomain: "renamed-e2e",
  madrasaName: "Renamed Madrasa (E2E)",
  tagline: "Excellence in Quranic Education",
  logoUrl: undefined,
  enabled: true,
  requireEmailVerification: false,
  adminEmail: "admin@renamed-e2e.org",
  createdAt: "2026-11-25T10:00:00.000Z",
};

function renderTableHtml(): string {
  return renderToStaticMarkup(
    <WorkspaceTableView
      workspaces={[sampleWorkspace]}
      descriptor={platformWorkspacesEntityDescriptor}
      appDomain="madrasah.io"
      sortField="name"
      sortDirection="asc"
      onToggleSort={vi.fn()}
      togglePending={false}
      deletePending={false}
      onToggleEnabled={vi.fn()}
      onToggleEmailVerification={vi.fn()}
      onOpenModules={vi.fn()}
      onOpenDelete={vi.fn()}
      onOpenResetPassword={vi.fn()}
      onOpenCreateAdmin={vi.fn()}
      onOpenRename={vi.fn()}
      onInspect={vi.fn()}
      selectedSubdomains={new Set()}
      onToggleSelect={vi.fn()}
      onToggleSelectAll={vi.fn()}
    />,
  );
}

describe("WorkspaceTableView column sizing and overflow contract", () => {
  it("assigns explicit pixel width to madrasaName header and sizes table minWidth above sum of fixed columns", () => {
    const html = renderTableHtml();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const table = doc.querySelector("table");
    expect(table).not.toBeNull();
    const tableMinWidth = Number.parseInt(table?.style.minWidth ?? "0", 10);
    // Selection (48) + madrasaName (300) + enabled (160) + emailVerification (208) + createdAt (144) + actions (288) = 1148
    expect(tableMinWidth).toBeGreaterThanOrEqual(1100);

    const headers = [...doc.querySelectorAll<HTMLTableCellElement>("thead th")];
    expect(headers.length).toBeGreaterThanOrEqual(6);
    const madrasaHeader = headers[1];
    expect(Number.parseInt(madrasaHeader?.style.width ?? "0", 10)).toBeGreaterThanOrEqual(280);
    expect(madrasaHeader?.getAttribute("aria-sort")).toBe("ascending");
  });

  it("keeps WorkspaceIdentityCell heading single-line truncatable without conflicting text-balance", () => {
    const html = renderTableHtml();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const heading = doc.querySelector("tbody h3");
    expect(heading?.textContent).toBe("Renamed Madrasa (E2E)");
    expect(heading?.className).toContain("truncate");
    expect(heading?.className).toContain("min-w-0");
    expect(heading?.className).toContain("flex-1");
    expect(heading?.className).not.toContain("text-balance");
  });

  it("wraps WorkspaceRowActions buttons cleanly inside a wide overflow-clipped actions column", () => {
    const html = renderTableHtml();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const actionsCell = doc.querySelector("tbody tr td:last-child");
    expect(actionsCell?.className).toContain("w-72");
    expect(actionsCell?.className).toContain("overflow-hidden");

    const actionsWrapper = actionsCell?.firstElementChild;
    expect(actionsWrapper?.className).toContain("flex-wrap");
  });

  it("respects non-sortable descriptor fields such as requireEmailVerification", () => {
    const html = renderTableHtml();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const headers = [...doc.querySelectorAll("thead th")];
    const emailVerificationHeader = headers.find((th) =>
      th.textContent?.includes("Email Verification"),
    );
    expect(emailVerificationHeader).toBeDefined();
    expect(emailVerificationHeader?.querySelector("button")).toBeNull();
  });
});

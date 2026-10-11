import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformWorkspaceCreateAdminDialog } from "../PlatformWorkspaceCreateAdminDialog";
import type { PlatformWorkspaceRow } from "@mms/shared";

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    open,
    title,
    subtitle,
    children,
    footer,
    saveLabel,
    cancelLabel,
  }: {
    open: boolean;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    saveLabel?: string;
    cancelLabel?: string;
  }) =>
    open ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        {subtitle ? <h3>{subtitle}</h3> : null}
        <div>{children}</div>
        {footer ? <div>{footer}</div> : null}
        {cancelLabel ? <div>{cancelLabel}</div> : null}
        {saveLabel ? <div>{saveLabel}</div> : null}
      </div>
    ) : null,
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockWorkspace: PlatformWorkspaceRow = {
  subdomain: "darul-ulum",
  madrasaName: "Darul Ulum",
  enabled: true,
  createdAt: "2026-01-01",
};

describe("PlatformWorkspaceCreateAdminDialog", () => {
  it("returns null when open is false or workspace is null", () => {
    const htmlClosed = renderToStaticMarkup(
      <PlatformWorkspaceCreateAdminDialog
        open={false}
        onOpenChange={vi.fn()}
        workspace={mockWorkspace}
        createPending={false}
        onConfirm={vi.fn()}
      />,
    );
    expect(htmlClosed).toBe("");

    const htmlNullWorkspace = renderToStaticMarkup(
      <PlatformWorkspaceCreateAdminDialog
        open={true}
        onOpenChange={vi.fn()}
        workspace={null}
        createPending={false}
        onConfirm={vi.fn()}
      />,
    );
    expect(htmlNullWorkspace).toBe("");
  });

  it("renders form inputs for administrator name, email, and password when open", () => {
    const html = renderToStaticMarkup(
      <PlatformWorkspaceCreateAdminDialog
        open={true}
        onOpenChange={vi.fn()}
        workspace={mockWorkspace}
        createPending={false}
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toContain("platform.createAdminUser");
    expect(html).toContain("Darul Ulum");
    expect(html).toContain("darul-ulum");
    expect(html).toContain("platform.adminNameLabel");
    expect(html).toContain("platform.adminEmailLabel");
    expect(html).toContain("platform.initialPasswordLabel");
    expect(html).toContain("platform.confirmPlatformPassword");
    expect(html).toContain("platform.createAdminBtn");
  });
});

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TypedConfirmDialog } from "@/components/app/TypedConfirmDialog";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@radix-ui/react-alert-dialog", () => ({
  Root: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Overlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Title: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  Description: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  Footer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cancel: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  Action: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

describe("TypedConfirmDialog", () => {
  it("renders title, description, and form fields when open", () => {
    const html = renderToStaticMarkup(
      <TypedConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete Workspace Confirmation"
        description="Are you sure you want to permanently delete this workspace?"
        confirmLabel="Type workspace subdomain to confirm"
        expectedConfirm="demo-madrasa"
        confirmValue="demo-madrasa"
        onConfirmValueChange={vi.fn()}
        password=""
        onPasswordChange={vi.fn()}
        passwordInputId="confirm-pass"
        error={null}
        pending={false}
        confirmButtonLabel="Delete Permanently"
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toContain("Delete Workspace Confirmation");
    expect(html).toContain("Are you sure you want to permanently delete this workspace?");
    expect(html).toContain("Type workspace subdomain to confirm");
    expect(html).toContain("Delete Permanently");
  });

  it("renders error message when error prop is provided", () => {
    const html = renderToStaticMarkup(
      <TypedConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete Workspace Confirmation"
        description="Are you sure you want to permanently delete this workspace?"
        confirmLabel="Type workspace subdomain to confirm"
        expectedConfirm="demo-madrasa"
        confirmValue=""
        onConfirmValueChange={vi.fn()}
        password=""
        onPasswordChange={vi.fn()}
        passwordInputId="confirm-pass"
        error="Invalid password supplied"
        pending={false}
        confirmButtonLabel="Delete Permanently"
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toContain("Invalid password supplied");
  });

  it("renders nothing when open is false", () => {
    const html = renderToStaticMarkup(
      <TypedConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Delete Workspace"
        description="Description"
        confirmLabel="Confirm"
        expectedConfirm="confirm"
        confirmValue=""
        onConfirmValueChange={vi.fn()}
        password=""
        onPasswordChange={vi.fn()}
        passwordInputId="confirm-pass"
        error={null}
        pending={false}
        confirmButtonLabel="Confirm"
        onConfirm={vi.fn()}
      />,
    );

    expect(html).toBe("");
  });
});

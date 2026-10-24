import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsSyncConflictPanel } from "./ContactsSyncConflictPanel";

vi.mock("@/tenant/features/contacts/hooks/useContactsSyncOutbox", () => ({
  useContactsSyncOutbox: () => ({
    flush: vi.fn(),
    refreshCounts: vi.fn(),
  }),
}));

vi.mock("@/lib/contacts/contactsSyncOutbox", () => ({
  getContactsSyncConflicts: () => [],
  describeContactsOutboxEntry: () => ({ title: "Conflict" }),
  dismissContactsSyncConflict: vi.fn(),
  requeueAllContactsSyncConflicts: vi.fn(),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/Modal", () => ({
  Modal: ({
    open,
    title,
    children,
    footer,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        <div>{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    ) : null,
}));

describe("ContactsSyncConflictPanel Component", () => {
  it("renders conflict modal with empty notice when there are no conflicts", () => {
    const html = renderToStaticMarkup(<ContactsSyncConflictPanel open={true} onClose={vi.fn()} />);

    expect(html).toContain("contacts.sync.conflictReviewTitle");
    expect(html).toContain("contacts.sync.conflictReviewEmpty");
  });
});

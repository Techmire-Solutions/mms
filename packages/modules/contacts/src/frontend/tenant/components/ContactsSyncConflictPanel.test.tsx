import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsSyncConflictPanel } from "./ContactsSyncConflictPanel.js";

vi.mock("../hooks/useContactsSyncOutbox", () => ({
  useContactsSyncOutbox: () => ({
    flush: vi.fn(),
    refreshCounts: vi.fn(),
  }),
}));

vi.mock("@mms/mod-contacts/frontend/tenant/lib/contactsSyncOutbox", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  getContactsSyncConflicts: () => [],
  describeContactsOutboxEntry: () => ({ title: "Conflict" }),
  dismissContactsSyncConflict: vi.fn(),
  requeueAllContactsSyncConflicts: vi.fn(),
}));

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@mms/fe-core/components/Modal", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
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

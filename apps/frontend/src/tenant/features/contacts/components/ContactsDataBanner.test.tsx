import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactsDataBanner } from "./ContactsDataBanner";

vi.mock("@/tenant/features/contacts/hooks/useContactsSyncOutbox", () => ({
  useContactsSyncOutbox: () => ({
    pendingCount: 2,
    conflictCount: 1,
    flushing: false,
    flush: vi.fn(),
    clearConflicts: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      return key;
    },
  }),
}));

vi.mock("@/tenant/features/contacts/components/ContactsDataBannerRows", () => ({
  ContactsOfflineBanner: () => <div data-testid="offline-banner">Offline</div>,
  ContactsPendingBanner: ({ pendingCount }: { pendingCount: number }) => (
    <div data-testid="pending-banner">Pending: {pendingCount}</div>
  ),
  ContactsConflictBanner: ({ conflictCount }: { conflictCount: number }) => (
    <div data-testid="conflict-banner">Conflicts: {conflictCount}</div>
  ),
}));

describe("ContactsDataBanner Component", () => {
  it("renders pending and conflict banners when counts are positive", () => {
    const html = renderToStaticMarkup(<ContactsDataBanner onReviewConflicts={vi.fn()} />);

    expect(html).toContain("Pending: 2");
    expect(html).toContain("Conflicts: 1");
  });
});

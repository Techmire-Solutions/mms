import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ContactsOfflineBanner,
  ContactsPendingBanner,
  ContactsConflictBanner,
} from "./ContactsDataBannerRows";

const t = ((key: string, params?: Record<string, string | number>) => {
  if (params?.count !== undefined) return `${key}:${params.count}`;
  return key;
}) as never;

describe("ContactsDataBannerRows Components", () => {
  it("renders ContactsOfflineBanner", () => {
    const html = renderToStaticMarkup(<ContactsOfflineBanner t={t} />);
    expect(html).toContain("contacts.sync.offline");
  });

  it("renders ContactsPendingBanner with retry button", () => {
    const html = renderToStaticMarkup(
      <ContactsPendingBanner pendingCount={3} flushing={false} onFlush={vi.fn()} t={t} />,
    );
    expect(html).toContain("contacts.sync.pending:3");
    expect(html).toContain("contacts.sync.retryNow");
  });

  it("renders ContactsConflictBanner with review and dismiss buttons", () => {
    const html = renderToStaticMarkup(
      <ContactsConflictBanner conflictCount={2} onReview={vi.fn()} onDismissAll={vi.fn()} t={t} />,
    );
    expect(html).toContain("contacts.sync.conflicts:2");
    expect(html).toContain("contacts.sync.reviewConflicts");
    expect(html).toContain("contacts.sync.dismissConflicts");
  });
});

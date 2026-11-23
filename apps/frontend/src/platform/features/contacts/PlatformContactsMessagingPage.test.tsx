import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import ContactsPage from "@/platform/features/contacts/ContactsPage";
import MessagingPage from "@/platform/features/messaging/MessagingPage";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({
    isSuperUser: true,
    can: () => true,
    canContacts: true,
    canMessaging: true,
    platformUser: { id: "u1", name: "Zaid", email: "z@example.com", role: "super_user" },
  }),
}));

vi.mock("@/platform/features/contacts/components/ContactsWorkTier", () => ({
  ContactsWorkTier: () => <div>contacts-work</div>,
}));
vi.mock("@/platform/features/contacts/components/ContactsReportsTier", () => ({
  ContactsReportsTier: () => <div>contacts-reports</div>,
}));
vi.mock("@/platform/features/contacts/components/ContactsSetupTier", () => ({
  ContactsSetupTier: () => <div>contacts-setup</div>,
}));
vi.mock("@/platform/features/messaging/components/MessagingWorkTier", () => ({
  MessagingWorkTier: () => <div>messaging-work</div>,
}));
vi.mock("@/platform/features/messaging/components/MessagingReportsTier", () => ({
  MessagingReportsTier: () => <div>messaging-reports</div>,
}));
vi.mock("@/platform/features/messaging/components/MessagingSetupTier", () => ({
  MessagingSetupTier: () => <div>messaging-setup</div>,
}));

describe("platform Contacts + Messaging module pages", () => {
  it("renders the contacts module with the module-named Work tab", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ContactsPage />
      </MemoryRouter>,
    );
    expect(html).toContain("nav.contacts");
    expect(html).not.toContain("module.work");
    expect(html).toContain("module.reports");
    expect(html).toContain("module.setup");
  });

  it("renders the messaging module with the module-named Work tab", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <MessagingPage />
      </MemoryRouter>,
    );
    expect(html).toContain("nav.messaging");
    expect(html).not.toContain("module.work");
    expect(html).toContain("module.reports");
    expect(html).toContain("module.setup");
  });
});

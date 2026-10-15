import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessagingWorkRecipientsCards } from "./MessagingWorkRecipientsCards";
import type { Contact } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

const mockContacts: Contact[] = [
  {
    id: "c-1",
    name: "Zayd Mansoor",
    firstName: "Zayd",
    lastName: "Mansoor",
    gender: "male",
    roles: ["student"],
    phones: [{ number: "+1234567890", label: "mobile", isPrimary: true }],
    emails: [{ address: "zayd@example.com", label: "personal", isPrimary: true }],
  },
];

const baseProps = {
  contacts: mockContacts,
  selectedById: {},
  allVisibleSelected: false,
  someVisibleSelected: false,
  selectedCountLabel: "0 selected",
  pageCountLabel: "1 contact",
  reducedMotion: false,
  showPhoneCol: true,
  showEmailCol: true,
  onToggleRecipient: vi.fn(),
  onToggleAllVisible: vi.fn(),
};

describe("MessagingWorkRecipientsCards", () => {
  it("renders recipient card with name, phone, and email", () => {
    const html = renderToStaticMarkup(<MessagingWorkRecipientsCards {...baseProps} />);
    expect(html).toContain("Zayd Mansoor");
    expect(html).toContain("+1 234567890");
    expect(html).toContain("zayd@example.com");
  });

  it("renders select checkbox", () => {
    const html = renderToStaticMarkup(<MessagingWorkRecipientsCards {...baseProps} />);
    expect(html).toContain('type="checkbox"');
  });

  it("applies selected style when contact is selected", () => {
    const html = renderToStaticMarkup(
      <MessagingWorkRecipientsCards
        {...baseProps}
        selectedById={{ "c-1": { id: "c-1", name: "Zayd Mansoor" } as unknown as never }}
      />,
    );
    expect(html).toContain("border-primary/50");
  });

  it("renders empty state without crashing", () => {
    const html = renderToStaticMarkup(
      <MessagingWorkRecipientsCards {...baseProps} contacts={[]} />,
    );
    expect(html).toBeDefined();
  });
});

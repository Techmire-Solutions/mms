import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingWorkRecipientsList } from "./MessagingWorkRecipientsList";
import type { Contact } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

import { contactToRecipient } from "../lib/messagingWorkPanelShared";

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
  {
    id: "c-2",
    name: "Maryam Hassan",
    firstName: "Maryam",
    lastName: "Hassan",
    gender: "female",
    roles: ["teacher"],
    phones: [],
    emails: [],
  },
];

describe("MessagingWorkRecipientsList Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders empty directory state when contacts list is empty", async () => {
    await act(async () => {
      root.render(
        <MessagingWorkRecipientsList
          viewMode="table"
          contacts={[]}
          selectedById={{}}
          allVisibleSelected={false}
          someVisibleSelected={false}
          selectedCount={0}
          selectedCountLabel="0 selected"
          pageCountLabel="0 total"
          isPending={false}
          isFetching={false}
          isError={false}
          onRetry={vi.fn()}
          hasActiveFilters={false}
          onClearFilters={vi.fn()}
          onPageChange={vi.fn()}
          getColumnWidth={() => 100}
          onToggleRecipient={vi.fn()}
          onToggleAllVisible={vi.fn()}
          setColumnWidth={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("messaging.noMatchingRecipients");
  });

  it("renders table rows for contacts with initials and phone", async () => {
    const onToggleRecipient = vi.fn();

    await act(async () => {
      root.render(
        <MessagingWorkRecipientsList
          viewMode="table"
          contacts={mockContacts}
          selectedById={{ "c-1": contactToRecipient(mockContacts[0]!) }}
          allVisibleSelected={false}
          someVisibleSelected={true}
          selectedCount={1}
          selectedCountLabel="1 selected"
          pageCountLabel="2 total"
          isPending={false}
          isFetching={false}
          isError={false}
          onRetry={vi.fn()}
          hasActiveFilters={false}
          onClearFilters={vi.fn()}
          onPageChange={vi.fn()}
          getColumnWidth={() => 100}
          onToggleRecipient={onToggleRecipient}
          onToggleAllVisible={vi.fn()}
          setColumnWidth={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("Zayd Mansoor");
    expect(container.textContent).toContain("+1 234567890");
    expect(container.textContent).toContain("zayd@example.com");
    expect(container.textContent).toContain("messaging.missingPhone");

    const checkboxes = container.querySelectorAll('button[role="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);

    await act(async () => {
      (checkboxes[1] as HTMLElement).click();
    });

    expect(onToggleRecipient).toHaveBeenCalledWith(mockContacts[0]);
  });

  it("renders card items when viewMode is cards", async () => {
    await act(async () => {
      root.render(
        <MessagingWorkRecipientsList
          viewMode="cards"
          contacts={mockContacts}
          selectedById={{}}
          allVisibleSelected={false}
          someVisibleSelected={false}
          selectedCount={0}
          selectedCountLabel="0 selected"
          pageCountLabel="2 total"
          isPending={false}
          isFetching={false}
          isError={false}
          onRetry={vi.fn()}
          hasActiveFilters={false}
          onClearFilters={vi.fn()}
          onPageChange={vi.fn()}
          getColumnWidth={() => 100}
          onToggleRecipient={vi.fn()}
          onToggleAllVisible={vi.fn()}
          setColumnWidth={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("Zayd Mansoor");
    expect(container.textContent).toContain("Maryam Hassan");
  });
});

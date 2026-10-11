import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactsList } from "./ContactsList";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

vi.mock("@/tenant/features/contacts/components/ContactsListCards", () => ({
  default: () => <div data-testid="contacts-cards-mock">ContactsCards</div>,
}));

vi.mock("@/tenant/features/contacts/components/ContactsListDesktopTable", () => ({
  default: () => <div data-testid="contacts-table-mock">ContactsTable</div>,
}));

const mockContact: Contact = {
  id: "cnt-1",
  firstName: "Farhan",
  lastName: "Ahmad",
  name: "Br. Farhan",
  email: "farhan@example.com",
  phone: "+1 555-0100",
  gender: "male",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const baseProps = {
  isWorkError: false,
  isWorkLoading: false,
  isWorkFetching: false,
  onRetryWork: vi.fn(),
  workContacts: [mockContact],
  tableColumns: [{ id: "name", key: "name", label: "Name", visible: true }],
  hasActiveFilters: false,
  viewingDeleted: false,
  canWrite: true,
  onClearFilters: vi.fn(),
  viewMode: "table" as const,
  commonDirectoryProps: {} as never,
  tableProps: {} as never,
  useServerWork: false,
  onPageChange: vi.fn(),
};

describe("ContactsList Component", () => {
  it("renders table view when viewMode is table", () => {
    const html = renderToStaticMarkup(<ContactsList {...baseProps} />);

    expect(html).toContain('data-testid="contacts-table-mock"');
  });

  it("renders cards view when viewMode is cards", () => {
    const html = renderToStaticMarkup(<ContactsList {...baseProps} viewMode="cards" />);

    expect(html).toContain('data-testid="contacts-cards-mock"');
  });

  it("renders empty state when workContacts is empty", () => {
    const html = renderToStaticMarkup(<ContactsList {...baseProps} workContacts={[]} />);

    expect(html).toContain("contacts.noContactsYet");
  });
});

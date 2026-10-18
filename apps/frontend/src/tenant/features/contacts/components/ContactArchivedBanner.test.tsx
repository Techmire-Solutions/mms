import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactArchivedBanner } from "./ContactArchivedBanner";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.date) return `Archived on ${params.date}`;
      return key;
    },
  }),
}));

const activeContact: Contact = {
  id: "cnt-1",
  name: "Active Contact",
  firstName: "Active",
  lastName: "Contact",
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const deletedContact: Contact = {
  ...activeContact,
  id: "cnt-2",
  name: "Archived Contact",
  deletedAt: "2024-06-01T12:00:00Z",
  deletionReason: "Graduated",
};

describe("ContactArchivedBanner Component", () => {
  it("renders banner with deletion reason when contact is archived", () => {
    const html = renderToStaticMarkup(<ContactArchivedBanner contact={deletedContact} />);

    expect(html).toContain("Archived on");
    expect(html).toContain("Graduated");
  });

  it("returns null when contact is not deleted", () => {
    const html = renderToStaticMarkup(<ContactArchivedBanner contact={activeContact} />);

    expect(html).toBe("");
  });
});

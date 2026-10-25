import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactCardInfoPills } from "./ContactCardSections";

vi.mock("@/components/app/DirectoryCardInfoPills", () => ({
  DirectoryCardInfoPills: ({
    phones,
    emails,
  }: {
    phones: Array<{ phoneDisplay: string }>;
    emails: Array<{ email: string }>;
  }) => (
    <div data-testid="info-pills">
      {phones.map((p, i) => (
        <span key={i}>{p.phoneDisplay}</span>
      ))}
      {emails.map((e, i) => (
        <span key={i}>{e.email}</span>
      ))}
    </div>
  ),
}));

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  phone: "+92 300 1234567",
  email: "zayd@example.com",
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactCardInfoPills Component", () => {
  it("renders phones and emails based on column visibility", () => {
    const html = renderToStaticMarkup(
      <ContactCardInfoPills contact={mockContact} isColumnVisible={() => true} />,
    );

    expect(html).toContain("300 1234567");
    expect(html).toContain("zayd@example.com");
  });
});

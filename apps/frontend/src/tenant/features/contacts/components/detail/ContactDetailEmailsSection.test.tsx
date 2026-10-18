import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailEmailsSection } from "./ContactDetailEmailsSection";

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  emails: [{ address: "zayd@example.com", label: "personal" }],
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactDetailEmailsSection Component", () => {
  it("renders email rows correctly", () => {
    const html = renderToStaticMarkup(
      <ContactDetailEmailsSection contact={mockContact} emailLabels={["personal", "work"]} />,
    );

    expect(html).toContain("zayd@example.com");
  });
});

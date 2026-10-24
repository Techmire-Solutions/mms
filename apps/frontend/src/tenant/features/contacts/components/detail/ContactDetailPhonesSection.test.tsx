import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailPhonesSection } from "./ContactDetailPhonesSection";

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  phones: [{ number: "3001234567", countryCode: "+92", label: "mobile" }],
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactDetailPhonesSection Component", () => {
  it("renders phone rows with formatted phone numbers", () => {
    const html = renderToStaticMarkup(
      <ContactDetailPhonesSection
        contact={mockContact}
        phoneLabels={["mobile", "home"]}
        defaultPhoneCountryCode="+92"
      />,
    );

    expect(html).toContain("3001234567");
  });
});

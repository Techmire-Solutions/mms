import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailAddressesSection } from "./ContactDetailAddressesSection";

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  addresses: [
    { label: "home", line1: "123 Street", city: "Karachi", state: "Sindh", country: "Pakistan" },
  ],
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactDetailAddressesSection Component", () => {
  it("renders address rows correctly", () => {
    const html = renderToStaticMarkup(
      <ContactDetailAddressesSection contact={mockContact} addressLabels={["home", "work"]} />,
    );

    expect(html).toContain("123 Street, Karachi, Sindh, Pakistan");
  });
});

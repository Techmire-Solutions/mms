import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailSocialsSection } from "./ContactDetailSocialsSection";

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  socials: [{ platform: "twitter", url: "zayd_harith" }],
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactDetailSocialsSection Component", () => {
  it("renders socials section rows correctly", () => {
    const html = renderToStaticMarkup(
      <ContactDetailSocialsSection contact={mockContact} socialPlatforms={["twitter", "github"]} />,
    );

    expect(html).toContain("zayd_harith");
  });
});

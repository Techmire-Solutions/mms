import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailExperienceSection } from "./ContactDetailExperienceSection";

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  experience: [
    {
      title: "Senior Lead",
      organization: "Tech Systems",
      employmentType: "Full-time",
      location: "Karachi",
      startDate: "2021-01-01",
      isCurrent: true,
    },
  ],
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactDetailExperienceSection Component", () => {
  it("renders experience details correctly", () => {
    const html = renderToStaticMarkup(<ContactDetailExperienceSection contact={mockContact} />);

    expect(html).toContain("Senior Lead");
    expect(html).toContain("Tech Systems");
    expect(html).toContain("Full-time");
    expect(html).toContain("Karachi");
  });
});

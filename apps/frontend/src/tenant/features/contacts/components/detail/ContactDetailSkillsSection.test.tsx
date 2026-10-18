import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailSkillsSection } from "./ContactDetailSkillsSection";

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  skills: [
    {
      name: "Arabic Grammar",
      category: "Language",
      proficiency: "Expert",
      yearsOfExperience: "5",
      isCertified: true,
      issuer: "Al-Azhar",
    },
  ],
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactDetailSkillsSection Component", () => {
  it("renders skills details correctly", () => {
    const html = renderToStaticMarkup(<ContactDetailSkillsSection contact={mockContact} />);

    expect(html).toContain("Arabic Grammar");
    expect(html).toContain("Language");
    expect(html).toContain("Expert");
    expect(html).toContain("Al-Azhar");
  });
});

import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailEducationSection } from "./ContactDetailEducationSection";

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  education: [
    { degree: "BS Computer Science", institution: "FAST NUCES", year: "2020", grade: "A" },
  ],
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactDetailEducationSection Component", () => {
  it("renders education details correctly", () => {
    const html = renderToStaticMarkup(<ContactDetailEducationSection contact={mockContact} />);

    expect(html).toContain("BS Computer Science");
    expect(html).toContain("FAST NUCES");
    expect(html).toContain("2020");
  });
});

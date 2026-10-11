import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  StudentDetailContactSection,
  type StudentContactProfileData,
} from "./StudentDetailContactSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockContactProfile: StudentContactProfileData = {
  contactId: "cnt-123",
  displayName: "Zayd Harith",
  phones: [{ number: "+1 555-0100", label: "Mobile", isPrimary: true }],
  emails: [{ address: "zayd@example.com", label: "Personal", isPrimary: true }],
  addresses: [{ line1: "123 Main St", city: "London", country: "UK" }],
  cnic: "42101-1234567-1",
  isSyed: true,
  tags: ["VIP"],
};

describe("StudentDetailContactSection Component", () => {
  it("renders contact profile phones, emails, address, and syed badge", () => {
    const html = renderToStaticMarkup(
      <StudentDetailContactSection
        contactProfile={mockContactProfile}
        canMessage={true}
        onNavigateToContact={vi.fn()}
      />,
    );

    expect(html).toContain("students.detail.contactProfile");
    expect(html).toContain("+1 555-0100");
    expect(html).toContain("zayd@example.com");
    expect(html).toContain("123 Main St");
    expect(html).toContain("42101-1234567-1");
    expect(html).toContain("contacts.fields.isSyed");
    expect(html).toContain("VIP");
  });

  it("returns null when contactProfile is null", () => {
    const html = renderToStaticMarkup(<StudentDetailContactSection contactProfile={null} />);

    expect(html).toBe("");
  });
});

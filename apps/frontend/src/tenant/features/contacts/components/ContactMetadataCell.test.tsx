import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactMetadataCell } from "./ContactMetadataCell";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: "en",
  }),
}));

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  gender: "male",
  cnic: "1234512345671",
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactMetadataCell Component", () => {
  it("renders table cell correctly for cnic and gender", () => {
    const htmlCnic = renderToStaticMarkup(
      <ContactMetadataCell
        colId="cnic"
        contact={mockContact}
        prefs={{ showDetailedSolarAge: true, showLunarDob: false, showDetailedLunarAge: false }}
      />,
    );
    expect(htmlCnic).toContain("12345 1234567 1");

    const htmlGender = renderToStaticMarkup(
      <ContactMetadataCell
        colId="gender"
        contact={mockContact}
        prefs={{ showDetailedSolarAge: true, showLunarDob: false, showDetailedLunarAge: false }}
      />,
    );
    expect(htmlGender).toContain("Male");
  });
});

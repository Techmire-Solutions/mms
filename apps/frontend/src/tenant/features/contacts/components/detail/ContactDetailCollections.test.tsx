import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact } from "@mms/shared";
import { ContactDetailCollections } from "./ContactDetailCollections";

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    enabledTabIds: new Set(["phones", "emails", "addresses", "education"]),
    fields: {},
    phoneLabels: [],
    emailLabels: [],
    addressLabels: [],
    socialPlatforms: [],
    defaultPhoneCountryCode: "+92",
  }),
}));

vi.mock("./ContactDetailChannelSections", () => ({
  ContactDetailPhonesSection: () => <div data-testid="phones-section">Phones Section</div>,
  ContactDetailEmailsSection: () => <div data-testid="emails-section">Emails Section</div>,
  ContactDetailAddressesSection: () => <div data-testid="addresses-section">Addresses Section</div>,
  ContactDetailSocialsSection: () => <div data-testid="socials-section">Socials Section</div>,
  ContactDetailEducationSection: () => <div data-testid="education-section">Education Section</div>,
  ContactDetailExperienceSection: () => (
    <div data-testid="experience-section">Experience Section</div>
  ),
  ContactDetailSkillsSection: () => <div data-testid="skills-section">Skills Section</div>,
}));

vi.mock("./ContactDetailCustomCollections", () => ({
  ContactDetailCustomCollections: () => (
    <div data-testid="custom-collections">Custom Collections</div>
  ),
}));

const mockContact: Contact = {
  id: "cnt-1",
  name: "Zayd Harith",
  firstName: "Zayd",
  lastName: "Harith",
  type: "student",
  status: "active",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactDetailCollections Component", () => {
  it("renders enabled collection sections", () => {
    const html = renderToStaticMarkup(
      <ContactDetailCollections
        contact={mockContact}
        visibleCollectionFields={{
          phones: [{ enabled: true }],
          emails: [{ enabled: true }],
          addresses: [{ enabled: true }],
          socials: [],
          education: [{ enabled: true }],
          experience: [],
          skills: [],
        }}
      />,
    );

    expect(html).toContain("Phones Section");
    expect(html).toContain("Emails Section");
    expect(html).toContain("Addresses Section");
    expect(html).toContain("Education Section");
  });
});

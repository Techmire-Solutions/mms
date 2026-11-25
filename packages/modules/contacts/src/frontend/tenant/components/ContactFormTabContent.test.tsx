import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactFormTabContent, type ContactFormDraftState } from "./ContactFormTabContent.js";

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./formTabs/ContactBasicTab.js", () => ({
  ContactBasicTab: () => <div data-testid="basic-tab">Basic Tab</div>,
}));

vi.mock("./formTabs/ContactPhonesTab.js", () => ({
  ContactPhonesTab: () => <div data-testid="phones-tab">Phones Tab</div>,
}));

vi.mock("./formTabs/ContactEmailsTab.js", () => ({
  ContactEmailsTab: () => <div data-testid="emails-tab">Emails Tab</div>,
}));

vi.mock("./formTabs/ContactAddressesTab.js", () => ({
  ContactAddressesTab: () => <div data-testid="addresses-tab">Addresses Tab</div>,
}));

vi.mock("./formTabs/ContactSocialsTab.js", () => ({
  ContactSocialsTab: () => <div data-testid="socials-tab">Socials Tab</div>,
}));

vi.mock("./formTabs/ContactEducationTab.js", () => ({
  ContactEducationTab: () => <div data-testid="education-tab">Education Tab</div>,
}));

vi.mock("./formTabs/ContactExperienceTab.js", () => ({
  ContactExperienceTab: () => <div data-testid="experience-tab">Experience Tab</div>,
}));

vi.mock("./formTabs/ContactSkillsTab.js", () => ({
  ContactSkillsTab: () => <div data-testid="skills-tab">Skills Tab</div>,
}));

vi.mock("./formTabs/ContactRelationshipTab.js", () => ({
  ContactRelationshipTab: () => <div data-testid="relationship-tab">Relationship Tab</div>,
}));

const mockDraft = {
  contactDraft: { firstName: "Zayd" },
  collectionCounts: {},
  formInstanceId: "inst-1",
  duplicateCount: 0,
  isFieldEnabled: () => true,
  isFieldRequired: () => false,
  getFieldError: () => undefined,
  getListItemError: () => undefined,
  getLocalId: () => "loc-1",
  updateDraft: vi.fn(),
  updateGenders: vi.fn(),
  updateTags: vi.fn(),
  updatePhoneLabels: vi.fn(),
  updateDialCodeOptions: vi.fn(),
  updateEmailLabels: vi.fn(),
  updateAddressLabels: vi.fn(),
  updateCountryOptions: vi.fn(),
  updateSocialPlatforms: vi.fn(),
  updateEducationDegrees: vi.fn(),
  updateEmploymentTypes: vi.fn(),
  updateSkillCategories: vi.fn(),
  updateSkillProficiencies: vi.fn(),
  updateRelationships: vi.fn(),
  addSubListItem: vi.fn(),
  ensureSubListItem: vi.fn(),
  updateSubListItem: vi.fn(),
  removeSubListItem: vi.fn(),
  handleAvatarChange: vi.fn(),
  handlePhoneBlur: vi.fn(),
  cropSrc: null,
  setCropSrc: vi.fn(),
  genders: [],
  tags: [],
  phoneLabels: [],
  defaultCountryCode: "+92",
  countryCodeOptions: [],
  emailLabels: [],
  addressLabels: [],
  countryOptions: [],
  socialPlatforms: [],
  educationDegrees: [],
  employmentTypes: [],
  skillCategories: [],
  skillProficiencies: [],
  relationshipOptions: [],
  lookupsLoading: false,
} as unknown as ContactFormDraftState;

describe("ContactFormTabContent Component", () => {
  it("renders loading indicator when lookups are loading", () => {
    const html = renderToStaticMarkup(
      <ContactFormTabContent
        tab="basic"
        draft={{ ...mockDraft, lookupsLoading: true }}
        lockGender={false}
        defaultCountry="Pakistan"
        defaultCity="Karachi"
        defaultProvince="Sindh"
      />,
    );

    expect(html).toContain("common.loading");
    expect(html).not.toContain("Basic Tab");
  });

  it("renders basic tab when tab is 'basic'", () => {
    const html = renderToStaticMarkup(
      <ContactFormTabContent
        tab="basic"
        draft={mockDraft}
        lockGender={false}
        defaultCountry="Pakistan"
        defaultCity="Karachi"
        defaultProvince="Sindh"
      />,
    );

    expect(html).toContain("Basic Tab");
  });

  it("renders phones tab when tab is 'phones'", () => {
    const html = renderToStaticMarkup(
      <ContactFormTabContent
        tab="phones"
        draft={mockDraft}
        lockGender={false}
        defaultCountry="Pakistan"
        defaultCity="Karachi"
        defaultProvince="Sindh"
      />,
    );

    expect(html).toContain("Phones Tab");
  });
});

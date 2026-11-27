import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactFormFooterStart } from "./ContactFormFooterStart.js";

describe("ContactFormFooterStart Component", () => {
  it("renders firstName required warning when firstName is missing or whitespace-only", () => {
    const htmlEmpty = renderToStaticMarkup(
      <ContactFormFooterStart
        contactDraft={{}}
        collectionCounts={{
          filledPhones: 0,
          filledEmails: 0,
          filledAddresses: 0,
          filledSocials: 0,
          filledEducation: 0,
          filledExperience: 0,
          filledSkills: 0,
          filledRelationships: 0,
          filledBankDetails: 0,
        }}
        t={(k) => k}
      />,
    );
    expect(htmlEmpty).toContain("contacts.form.requiredFieldsHint");

    const htmlWhitespace = renderToStaticMarkup(
      <ContactFormFooterStart
        contactDraft={{ firstName: "   ", gender: "Male" }}
        collectionCounts={{
          filledPhones: 0,
          filledEmails: 0,
          filledAddresses: 0,
          filledSocials: 0,
          filledEducation: 0,
          filledExperience: 0,
          filledSkills: 0,
          filledRelationships: 0,
          filledBankDetails: 0,
        }}
        t={(k) => k}
      />,
    );
    expect(htmlWhitespace).toContain("contacts.form.firstNameRequired");
  });

  it("renders chips and properly pluralized badges when draft is populated", () => {
    const html = renderToStaticMarkup(
      <ContactFormFooterStart
        contactDraft={{ firstName: "Zayd", lastName: "Harith", gender: "Male" }}
        collectionCounts={{
          filledPhones: 2,
          filledEmails: 1,
          filledAddresses: 0,
          filledSocials: 0,
          filledEducation: 0,
          filledExperience: 0,
          filledSkills: 0,
          filledRelationships: 0,
          filledBankDetails: 1,
        }}
        t={(k) => k}
      />,
    );

    expect(html).toContain("Zayd Harith");
    expect(html).toContain("2 contacts.form.tabPhones");
    expect(html).toContain("1 contacts.form.countEmailOne");
    expect(html).toContain("1 contacts.form.countBankDetailOne");
  });
});

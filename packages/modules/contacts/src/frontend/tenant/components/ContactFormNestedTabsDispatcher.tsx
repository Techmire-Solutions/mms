import React from "react";
import { isContactCustomCollectionTab } from "@mms/contracts";
import { ContactCustomCollectionTab } from "./ContactCustomCollectionTab.js";
import { ContactPhonesTab } from "./formTabs/ContactPhonesTab.js";
import { ContactEmailsTab } from "./formTabs/ContactEmailsTab.js";
import { ContactAddressesTab } from "./formTabs/ContactAddressesTab.js";
import { ContactSocialsTab } from "./formTabs/ContactSocialsTab.js";
import { ContactEducationTab } from "./formTabs/ContactEducationTab.js";
import { ContactExperienceTab } from "./formTabs/ContactExperienceTab.js";
import { ContactSkillsTab } from "./formTabs/ContactSkillsTab.js";
import { ContactRelationshipTab } from "./formTabs/ContactRelationshipTab.js";
import { ContactBankDetailsTab } from "./formTabs/ContactBankDetailsTab.js";
import type { ContactSubListTabBaseProps } from "./formTabs/types.js";
import type { useContactFormDraft } from "../hooks/useContactFormDraft";

export interface ContactFormNestedTabsDispatcherProps {
  normalizedTab: string;
  draft: ReturnType<typeof useContactFormDraft>;
  listBase: ContactSubListTabBaseProps;
  defaultCountry: string;
  defaultCity: string;
  defaultProvince: string;
}

export function ContactFormNestedTabsDispatcher({
  normalizedTab,
  draft,
  listBase,
  defaultCountry,
  defaultCity,
  defaultProvince,
}: ContactFormNestedTabsDispatcherProps): React.JSX.Element | null {
  switch (normalizedTab) {
    case "phones":
      return (
        <ContactPhonesTab
          {...listBase}
          phoneLabels={draft.phoneLabels}
          onUpdatePhoneLabels={draft.updatePhoneLabels}
          defaultCountryCode={draft.defaultCountryCode}
          countryCodeOptions={draft.countryCodeOptions}
          onUpdateDialCodeOptions={draft.updateDialCodeOptions}
          handlePhoneBlur={draft.handlePhoneBlur}
        />
      );
    case "emails":
      return (
        <ContactEmailsTab
          {...listBase}
          emailLabels={draft.emailLabels}
          onUpdateEmailLabels={draft.updateEmailLabels}
        />
      );
    case "addresses":
      return (
        <ContactAddressesTab
          {...listBase}
          addressLabels={draft.addressLabels}
          onUpdateAddressLabels={draft.updateAddressLabels}
          countryOptions={draft.countryOptions}
          onUpdateCountryOptions={draft.updateCountryOptions}
          defaultCity={defaultCity}
          defaultProvince={defaultProvince}
          defaultCountry={defaultCountry}
        />
      );
    case "socials":
      return (
        <ContactSocialsTab
          {...listBase}
          socialPlatforms={draft.socialPlatforms}
          onUpdateSocialPlatforms={draft.updateSocialPlatforms}
        />
      );
    case "education":
      return (
        <ContactEducationTab
          {...listBase}
          degreeOptions={draft.educationDegrees}
          onUpdateDegreeOptions={draft.updateEducationDegrees}
        />
      );
    case "experience":
      return (
        <ContactExperienceTab
          {...listBase}
          employmentTypeOptions={draft.employmentTypes}
          onUpdateEmploymentTypeOptions={draft.updateEmploymentTypes}
        />
      );
    case "skills":
      return (
        <ContactSkillsTab
          {...listBase}
          categoryOptions={draft.skillCategories}
          onUpdateCategoryOptions={draft.updateSkillCategories}
          proficiencyOptions={draft.skillProficiencies}
          onUpdateProficiencyOptions={draft.updateSkillProficiencies}
        />
      );
    case "relationship":
      return <ContactRelationshipTab {...listBase} />;
    case "bankDetails":
      return <ContactBankDetailsTab {...listBase} />;
    default:
      return isContactCustomCollectionTab(normalizedTab) ? (
        <ContactCustomCollectionTab tabId={normalizedTab} draft={draft} />
      ) : null;
  }
}

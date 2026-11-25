import React from "react";
import { isContactCustomCollectionTab } from "@mms/contracts";
import { ContactCustomCollectionTab } from "@/tenant/features/contacts/components/ContactCustomCollectionTab";
import { ContactPhonesTab } from "@/tenant/features/contacts/components/formTabs/ContactPhonesTab";
import { ContactEmailsTab } from "@/tenant/features/contacts/components/formTabs/ContactEmailsTab";
import { ContactAddressesTab } from "@/tenant/features/contacts/components/formTabs/ContactAddressesTab";
import { ContactSocialsTab } from "@/tenant/features/contacts/components/formTabs/ContactSocialsTab";
import { ContactEducationTab } from "@/tenant/features/contacts/components/formTabs/ContactEducationTab";
import { ContactExperienceTab } from "@/tenant/features/contacts/components/formTabs/ContactExperienceTab";
import { ContactSkillsTab } from "@/tenant/features/contacts/components/formTabs/ContactSkillsTab";
import { ContactRelationshipTab } from "@/tenant/features/contacts/components/formTabs/ContactRelationshipTab";
import { ContactBankDetailsTab } from "@/tenant/features/contacts/components/formTabs/ContactBankDetailsTab";
import type { ContactSubListTabBaseProps } from "@/tenant/features/contacts/components/formTabs/types";
import type { useContactFormDraft } from "@/tenant/features/contacts/hooks/useContactFormDraft";

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

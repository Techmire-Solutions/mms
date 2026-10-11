import { useMemo, useState } from "react";
import type { Contact } from "@mms/shared";
import {
  buildInitialContactDraft,
  contactDraftSnapshot,
} from "@/tenant/features/contacts/hooks/contactFormDraftUtils";
import { useContactFormSubLists } from "@/tenant/features/contacts/hooks/useContactFormSubLists";
import { useContactFormSave } from "@/tenant/features/contacts/hooks/useContactFormSave";
import { useContactFormDraftHelpers } from "@/tenant/features/contacts/hooks/useContactFormDraftHelpers";
import { useContactDuplicateCheck } from "@/tenant/features/contacts/hooks/useContactDuplicateCheck";
import { useContactDraftReset } from "@/tenant/features/contacts/hooks/useContactDraftReset";
import { useContactFormLookups } from "@/tenant/features/contacts/hooks/useContactFormLookups";

export function useContactFormDraft({
  open,
  contact,
  initialDraft,
  defaultCountry,
  defaultCity,
  defaultProvince,
  onSave,
  onClose,
  onValidationTab,
}: {
  open: boolean;
  contact?: Contact;
  initialDraft?: Partial<Contact>;
  defaultCountry: string;
  defaultCity: string;
  defaultProvince: string;
  onSave: (contact: Contact) => void | Promise<void>;
  onClose: () => void;
  onValidationTab: (tabId: string, fieldId?: string, index?: number) => void;
}) {
  const {
    config,
    defaultCountryCode,
    optionDefaults,
    countryCodeOptions,
    countryOptions,
    updateCountryOptions,
    updateDialCodeOptions,
  } = useContactFormLookups(defaultCountry);

  const [instanceSuffix] = useState(() => Math.random().toString(36).substring(2, 8));
  const formInstanceId = `${contact?.id ?? "new"}-${instanceSuffix}`;

  const [contactDraft, setContactDraft] = useState<Partial<Contact>>(() =>
    buildInitialContactDraft({
      contact,
      initialDraft,
      defaultCity,
      defaultProvince,
      defaultCountry,
      optionDefaults,
      socialPlatforms: config.socialPlatforms,
      relationshipOptions: config.relationships,
    }),
  );
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    contactDraftSnapshot(contactDraft),
  );

  const { saving, validationErrors, setValidationErrors, handleSave } = useContactFormSave({
    contact,
    contactDraft,
    defaultCountryCode,
    onSave,
    onClose,
    onValidationTab,
    onBaselineReset: (finalized) => setBaselineSnapshot(contactDraftSnapshot(finalized)),
  });

  const isDirty = useMemo(
    () => contactDraftSnapshot(contactDraft) !== baselineSnapshot,
    [contactDraft, baselineSnapshot],
  );

  const {
    addSubListItem,
    ensureSubListItem,
    updateSubListItem,
    removeSubListItem,
    setPrimarySubListItem,
  } = useContactFormSubLists(setContactDraft);

  const {
    cropSrc,
    setCropSrc,
    collectionCounts,
    getLocalId,
    isFieldEnabled,
    isFieldRequired,
    getFieldError,
    getListItemError,
    updateDraft,
    handleAvatarChange,
    handlePhoneBlur,
  } = useContactFormDraftHelpers({
    formInstanceId,
    defaultCountryCode,
    validationErrors,
    contactDraft,
    setContactDraft,
    isTabFieldEnabled: config.isTabFieldEnabled,
    isTabFieldRequired: config.isTabFieldRequired,
  });

  useContactDraftReset({
    open,
    contact,
    initialDraft,
    defaultCity,
    defaultProvince,
    defaultCountry,
    optionDefaults,
    socialPlatforms: config.socialPlatforms,
    relationshipOptions: config.relationships,
    lookupsLoading: config.lookupsLoading,
    isDirty,
    setContactDraft,
    setBaselineSnapshot,
    setValidationErrors,
  });

  const duplicateCount = useContactDuplicateCheck({
    open,
    contactId: contact?.id,
    contactDraft,
  });

  return {
    formInstanceId,
    defaultCountryCode,
    duplicateCount,
    countryCodeOptions,
    countryOptions,
    updateCountryOptions,
    updateDialCodeOptions,
    saving,
    isDirty,
    cropSrc,
    setCropSrc,
    contactDraft,
    collectionCounts,
    phoneLabels: config.phoneLabels,
    emailLabels: config.emailLabels,
    addressLabels: config.addressLabels,
    socialPlatforms: config.socialPlatforms,
    relationshipOptions: config.relationships,
    genders: config.genders,
    educationDegrees: config.educationDegrees,
    employmentTypes: config.employmentTypes,
    skillCategories: config.skillCategories,
    skillProficiencies: config.skillProficiencies,
    tags: config.tags,
    lookupsLoading: config.lookupsLoading,
    lookupsError: config.lookupsError,
    updateGenders: config.updateGenders,
    updatePhoneLabels: config.updatePhoneLabels,
    updateEmailLabels: config.updateEmailLabels,
    updateAddressLabels: config.updateAddressLabels,
    updateSocialPlatforms: config.updateSocialPlatforms,
    updateRelationships: config.updateRelationships,
    updateEducationDegrees: config.updateEducationDegrees,
    updateEmploymentTypes: config.updateEmploymentTypes,
    updateSkillCategories: config.updateSkillCategories,
    updateSkillProficiencies: config.updateSkillProficiencies,
    updateTags: config.updateTags,
    getLocalId,
    isFieldEnabled,
    isFieldRequired,
    getFieldError,
    getListItemError,
    updateDraft,
    handleAvatarChange,
    handlePhoneBlur,
    addSubListItem,
    ensureSubListItem,
    updateSubListItem,
    removeSubListItem,
    setPrimarySubListItem,
    handleSave,
    validationErrors,
    fields: config.fields,
  };
}

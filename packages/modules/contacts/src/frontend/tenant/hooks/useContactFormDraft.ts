import { useMemo, useState } from "react";
import type { Contact } from "@mms/contracts";
import { buildInitialContactDraft, contactDraftSnapshot } from "./contactFormDraftUtils.js";
import { useContactFormSubLists } from "./useContactFormSubLists.js";
import { useContactFormSave } from "./useContactFormSave.js";
import { useContactFormDraftHelpers } from "./useContactFormDraftHelpers.js";
import { useContactDuplicateCheck } from "./useContactDuplicateCheck.js";
import { useContactDraftReset } from "./useContactDraftReset.js";
import { useContactFormLookups } from "./useContactFormLookups.js";

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

  const { saving, validationErrors, setValidationErrors, formError, handleSave } =
    useContactFormSave({
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
    getLocalId,
    addSubListItem,
    ensureSubListItem,
    updateSubListItem,
    removeSubListItem,
    setPrimarySubListItem,
  } = useContactFormSubLists(contactDraft, setContactDraft, formInstanceId);

  const {
    cropSrc,
    setCropSrc,
    collectionCounts,
    isFieldEnabled,
    isFieldRequired,
    getFieldError,
    getListItemError,
    updateDraft,
    handleAvatarChange,
    handleAvatarFileSelect,
    handlePhoneBlur,
  } = useContactFormDraftHelpers({
    formInstanceId,
    defaultCountryCode,
    validationErrors,
    setValidationErrors,
    contactDraft,
    setContactDraft,
    isTabFieldEnabled: config.isTabFieldEnabled,
    isTabFieldRequired: config.isTabFieldRequired,
    fields: config.fields,
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
    formError,
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
    handleAvatarFileSelect,
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

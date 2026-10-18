export {
  formatContactPhoneDisplay,
  formatContactPhoneFull,
  getFallbackCountryCode,
  resolveContactPhoneDisplay,
  resolveAllContactPhones,
  resolveAllContactEmails,
  type ContactResolvedPhone,
  type ContactResolvedEmail,
} from "@/lib/contacts/contactPhoneDisplay";

export {
  formatContactOptionLabel,
  resolvePhoneLabel,
  resolveEmailLabel,
  resolveAddressLabel,
  resolveSocialPlatformLabel,
  resolveRegistryLabel,
  resolveRegistryDescription,
  resolveSyncFieldLabel,
} from "@/lib/contacts/contactOptionI18n";

export { DUPLICATE_REASON_I18N, ACTIVITY_TYPE_I18N } from "@/lib/contacts/contactI18nKeys";

export {
  formatContactDobWithAge,
  formatContactCellValue,
  formatContactGenderLabel,
  getDuplicateFieldLabel,
  getDuplicateFieldValue,
  getSyncConflictKindLabel,
  buildContactsMap,
} from "@/lib/contacts/contactI18nFormat";

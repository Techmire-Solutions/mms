export {
  formatContactPhoneDisplay,
  formatContactPhoneFull,
  getFallbackCountryCode,
  resolveContactPhoneDisplay,
  resolveAllContactPhones,
  resolveAllContactEmails,
  type ContactResolvedPhone,
  type ContactResolvedEmail,
} from "../components/contact-action/contactPhoneDisplay.js";

export {
  formatContactOptionLabel,
  resolvePhoneLabel,
  resolveEmailLabel,
  resolveAddressLabel,
  resolveSocialPlatformLabel,
  resolveRegistryLabel,
  resolveRegistryDescription,
  resolveSyncFieldLabel,
} from "../components/contactOptionI18n.js";

export { DUPLICATE_REASON_I18N, ACTIVITY_TYPE_I18N } from "./contactI18nKeys.js";

export {
  formatContactDobWithAge,
  formatContactCellValue,
  formatContactGenderLabel,
  getDuplicateFieldLabel,
  getDuplicateFieldValue,
  getSyncConflictKindLabel,
  buildContactsMap,
} from "./contactI18nFormat.js";

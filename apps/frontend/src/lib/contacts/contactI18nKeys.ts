import type { AppTranslationKey, ContactDuplicateReasonKey } from "@mms/contracts";

export const DUPLICATE_REASON_I18N: Record<ContactDuplicateReasonKey, AppTranslationKey> = {
  cnic: "contacts.duplicates.reason.cnic",
  cnicName: "contacts.duplicates.reason.cnicName",
  phoneEmail: "contacts.duplicates.reason.phoneEmail",
  namePhone: "contacts.duplicates.reason.namePhone",
  phone: "contacts.duplicates.reason.phone",
  nameEmail: "contacts.duplicates.reason.nameEmail",
  email: "contacts.duplicates.reason.email",
  name: "contacts.duplicates.reason.name",
};

export const DUPLICATE_FIELD_I18N: Record<string, AppTranslationKey> = {
  name: "contacts.duplicates.field.name",
  phone: "contacts.duplicates.field.phone",
  email: "contacts.duplicates.field.email",
  gender: "contacts.duplicates.field.gender",
  dob: "contacts.duplicates.field.dob",
  cnic: "contacts.duplicates.field.cnic",
};

export const ACTIVITY_TYPE_I18N: Record<string, AppTranslationKey> = {
  note: "contacts.detail.activityNote",
  stage_change: "contacts.detail.activityStatusChange",
  system: "contacts.detail.activitySystem",
  sms: "contacts.sms",
  whatsapp: "contacts.whatsapp",
  email: "contacts.detail.activityEmail",
  call: "contacts.detail.activityCall",
  task: "contacts.detail.activityTask",
};

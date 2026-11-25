import type { TranslationFunction } from "@mms/fe-core/i18n";

export type FacultyMessagingLabels = {
  call: string;
  whatsapp: string;
  sms: string;
  email: string;
};

/** Localized messaging action labels shared by Faculty detail quick actions and card footer. */
export function facultyMessagingLabels(t: TranslationFunction): FacultyMessagingLabels {
  return {
    call: t("faculty.detail.call"),
    whatsapp: t("faculty.list.actionWhatsApp"),
    sms: t("faculty.list.actionSms"),
    email: t("faculty.list.actionEmail"),
  };
}

import React from "react";
import { Mail, Phone } from "lucide-react";
import { facultyFieldLabelKey, type Contact, type Faculty } from "@mms/shared";
import { ContactPhoneAction, ContactEmailAction } from "@/components/app/ContactAction";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { resolveAllContactPhones, resolveAllContactEmails } from "@/lib/contacts/contactI18n";
import { formatContactGenderLabel } from "@/lib/contacts/contactI18nFormat";
import { getGenderIcon, getGenderIconClass } from "@/lib/ui/genderUi";
import type { FacultyMessagingLabels } from "@/lib/faculty/facultyMessagingLabels";
import { FacultyDetailAttributeRow } from "@/tenant/features/faculty/components/FacultyDetailAttributeRow";

export interface BuildFacultyContactRowsParams {
  faculty: Faculty;
  displayName: string;
  t: TranslationFunction;
  emptyDash: string;
  messagingLabels: FacultyMessagingLabels;
}

/** Generates gender, phone, and email attribute rows for the Faculty detail drawer. */
export function buildFacultyContactRows({
  faculty,
  displayName,
  t,
  emptyDash,
  messagingLabels,
}: BuildFacultyContactRowsParams): React.ReactNode[] {
  const contactRows: React.ReactNode[] = [];

  contactRows.push(
    <FacultyDetailAttributeRow
      key="gender"
      variant="inset"
      icon={getGenderIcon(faculty.gender)}
      iconClassName={getGenderIconClass(faculty.gender)}
      label={t(facultyFieldLabelKey("gender"))}
      value={faculty.gender ? formatContactGenderLabel(faculty.gender, t) : emptyDash}
    />,
  );

  const contact: Partial<Contact> = {
    phone: faculty.phone,
    email: faculty.email,
  };

  const allPhones = resolveAllContactPhones(contact);
  const allEmails = resolveAllContactEmails(contact);

  if (allPhones.length > 0) {
    allPhones.forEach((p, idx) => {
      contactRows.push(
        <FacultyDetailAttributeRow
          key={`phone-${p.phone}-${idx}`}
          variant="inset"
          icon={Phone}
          label={p.label || t(facultyFieldLabelKey("phone"))}
          value={
            <ContactPhoneAction
              phone={p.phone}
              phoneDisplay={p.phoneDisplay}
              countryCode={p.countryCode}
              name={displayName}
              variant="inline"
              labels={{
                call: messagingLabels.call,
                sms: messagingLabels.sms,
                whatsapp: messagingLabels.whatsapp,
                copy: t("contacts.table.copy"),
                copied: t("contacts.table.copied"),
              }}
            />
          }
        />,
      );
    });
  }

  if (allEmails.length > 0) {
    allEmails.forEach((e, idx) => {
      contactRows.push(
        <FacultyDetailAttributeRow
          key={`email-${e.email}-${idx}`}
          variant="inset"
          icon={Mail}
          label={e.label || t(facultyFieldLabelKey("email"))}
          value={
            <ContactEmailAction
              email={e.email}
              name={displayName}
              variant="inline"
              labels={{
                mail: messagingLabels.email,
                copy: t("contacts.table.copy"),
                copied: t("contacts.table.copied"),
              }}
            />
          }
        />,
      );
    });
  }

  return contactRows;
}

import {
  getContactTags,
  getPrimaryPhone,
  getPrimaryEmail,
  type Address,
  type Contact,
  type EmailAddress,
  type PhoneNumber,
  type Student,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { StudentContactProfileData } from "@/tenant/features/students/components/StudentDetailContactSection";

/** Contact-derived profile blocks for the student detail hero (phones, emails, addresses, tag summary). */
export interface StudentContactProfileBundle {
  phones: PhoneNumber[];
  emails: EmailAddress[];
  addresses: Address[];
  profile: StudentContactProfileData;
}

function buildStudentPhones(
  student: Student,
  studentContact: Contact | null | undefined,
  t: TranslationFunction,
): PhoneNumber[] {
  if (studentContact?.phones && studentContact.phones.length > 0) {
    return studentContact.phones;
  }
  const fallbackPhone = (studentContact ? getPrimaryPhone(studentContact) : null) || student.phone;
  if (fallbackPhone) {
    return [{ number: fallbackPhone, label: t("contacts.fields.phoneNumber"), isPrimary: true }];
  }
  return [];
}

function buildStudentEmails(
  student: Student,
  studentContact: Contact | null | undefined,
  t: TranslationFunction,
): EmailAddress[] {
  if (studentContact?.emails && studentContact.emails.length > 0) {
    return studentContact.emails;
  }
  const fallbackEmail = (studentContact ? getPrimaryEmail(studentContact) : null) || student.email;
  if (fallbackEmail) {
    return [{ address: fallbackEmail, label: t("contacts.fields.emailAddress"), isPrimary: true }];
  }
  return [];
}

function buildStudentAddresses(
  student: Student,
  studentContact: Contact | null | undefined,
  t: TranslationFunction,
): Address[] {
  if (studentContact?.addresses && studentContact.addresses.length > 0) {
    return studentContact.addresses;
  }
  const line1 =
    (typeof studentContact?.address === "string" ? studentContact.address : undefined) ||
    (typeof studentContact?.line1 === "string" ? studentContact.line1 : undefined) ||
    (typeof student.address === "string" ? student.address : undefined);
  const city =
    (typeof studentContact?.city === "string" ? studentContact.city : undefined) ||
    (typeof student.city === "string" ? student.city : undefined);
  const state =
    (typeof studentContact?.state === "string" ? studentContact.state : undefined) ||
    (typeof student.state === "string" ? student.state : undefined);
  const country =
    (typeof studentContact?.country === "string" ? studentContact.country : undefined) ||
    (typeof student.country === "string" ? student.country : undefined);
  if (line1 || city || state || country) {
    const singleAddr: Address = {
      line1,
      city,
      state,
      country,
      label: t("students.detail.addressesLabel"),
      isPrimary: true,
    };
    return [singleAddr];
  }
  return [];
}

/** Hydrate the hero profile: linked contact blocks first, legacy student fields as fallback. */
export function buildStudentContactProfile(
  student: Student,
  studentContact: Contact | null | undefined,
  t: TranslationFunction,
): StudentContactProfileBundle {
  const phones = buildStudentPhones(student, studentContact, t);
  const emails = buildStudentEmails(student, studentContact, t);
  const addresses = buildStudentAddresses(student, studentContact, t);

  const rawTags = studentContact
    ? getContactTags(studentContact)
    : getContactTags({
        tag: typeof student.tag === "string" ? student.tag : undefined,
        tags: Array.isArray(student.tags) ? (student.tags as string[]) : undefined,
      });
  const isSyed =
    typeof studentContact?.isSyed === "boolean"
      ? studentContact.isSyed
      : typeof student.isSyed === "boolean"
        ? student.isSyed
        : undefined;

  return {
    phones,
    emails,
    addresses,
    profile: {
      contactId: student.contactId != null ? String(student.contactId) : undefined,
      displayName: studentContact?.name || student.name || "",
      phones,
      emails,
      addresses,
      cnic:
        (typeof studentContact?.cnic === "string" ? studentContact.cnic : undefined) ||
        student.cnic,
      isSyed,
      tags: rawTags,
    },
  };
}

import {
  mergeStoredAndDerivedSiblingLinks,
  STUDENT_GUARDIAN_RELATIONSHIP_LABEL,
  STUDENT_PARENT_RELATIONSHIP_LABEL,
  type Contact,
  type EmailAddress,
  type PhoneNumber,
  type Student,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { formatLocalizedRelationshipParts } from "@/lib/contacts/formatLocalizedRelationshipLabel";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { relationshipBadgeCode } from "@/tenant/features/students/lib/guardianRelationshipBadge";
import type { StudentRelationshipCardData } from "@/tenant/features/students/components/StudentRelationshipCard";

export interface StudentRelationshipInput {
  student: Student;
  studentContact: Contact | null | undefined;
  contactList: Contact[];
  guardians: {
    fatherContactId?: string;
    guardianContactId?: string;
    fatherName?: string;
    guardianName?: string;
  };
  t: TranslationFunction;
  emptyDash: string;
}

/**
 * Hydrated relationship cards: stored/derived sibling links plus Father and Guardian
 * triad entries, deduped by contact or display name, with inferred edges from contact metadata.
 */
export function buildStudentRelationships({
  student,
  studentContact,
  contactList,
  guardians,
  t,
  emptyDash,
}: StudentRelationshipInput): StudentRelationshipCardData[] {
  const mergedLinks = studentContact
    ? mergeStoredAndDerivedSiblingLinks(studentContact, contactList)
    : [];

  const relationshipKeySet = new Set<string>();
  const results: StudentRelationshipCardData[] = [];

  const addRelationshipItem = (
    contactId: string | undefined,
    name: string | undefined,
    relationshipStr: string,
    inferred = false,
    derivedSibling = false,
    phoneHint?: string,
    emailHint?: string,
    notesHint?: string,
  ) => {
    const target = contactId
      ? contactList.find((entry) => String(entry.id) === String(contactId))
      : undefined;

    const resolvedName = target?.name || name || t("students.detail.unknownContact");
    const key = contactId
      ? `contact-${contactId}-${relationshipStr}`
      : `name-${resolvedName.toLowerCase()}-${relationshipStr}`;

    if (relationshipKeySet.has(key)) return;
    relationshipKeySet.add(key);

    const resolvedGender = target?.gender;
    const { display, label } = formatLocalizedRelationshipParts(relationshipStr, resolvedGender, t);

    const targetPhones: PhoneNumber[] =
      target?.phones && target.phones.length > 0
        ? target.phones
        : target?.phone || phoneHint
          ? [
              {
                number: (target?.phone || phoneHint)!,
                label: t("contacts.fields.phoneNumber"),
                isPrimary: true,
              },
            ]
          : [];

    const targetEmails: EmailAddress[] =
      target?.emails && target.emails.length > 0
        ? target.emails
        : target?.email || emailHint
          ? [
              {
                address: (target?.email || emailHint)!,
                label: t("contacts.fields.emailAddress"),
                isPrimary: true,
              },
            ]
          : [];

    results.push({
      key,
      contactId: target?.id != null ? String(target.id) : contactId,
      name: resolvedName,
      avatar: target?.avatar,
      gender: resolvedGender,
      relationship: relationshipStr,
      relationshipLabel: label,
      badgeCode: relationshipBadgeCode(display, emptyDash),
      badgeTone: SEMANTIC_BADGE.info,
      inferred: inferred || Boolean(target && edgeIsInferred(contactId, studentContact)),
      derivedSibling,
      phones: targetPhones,
      emails: targetEmails,
      cnic: target?.cnic,
      notes: target?.notes || notesHint,
      targetContact: target,
    });
  };

  function edgeIsInferred(targetId?: string, subject?: Contact | null): boolean {
    if (!targetId || !subject?.relationshipContacts) return false;
    const found = subject.relationshipContacts.find(
      (r: { contactId?: string | number; inferred?: boolean }) =>
        String(r.contactId) === String(targetId),
    );
    return found?.inferred === true;
  }

  for (const link of mergedLinks) {
    addRelationshipItem(
      link.contactId ? String(link.contactId) : undefined,
      link.name,
      link.relationship || STUDENT_PARENT_RELATIONSHIP_LABEL,
      link.inferred === true,
      link.derivedSibling === true,
      link.phone,
    );
  }

  if (
    guardians.fatherContactId ||
    guardians.fatherName ||
    student.fatherName ||
    student.fatherContactId
  ) {
    const fatherId = guardians.fatherContactId
      ? String(guardians.fatherContactId)
      : student.fatherContactId
        ? String(student.fatherContactId)
        : undefined;
    const fatherName = guardians.fatherName || student.fatherName || undefined;
    addRelationshipItem(fatherId, fatherName, STUDENT_PARENT_RELATIONSHIP_LABEL);
  }

  if (
    guardians.guardianContactId ||
    guardians.guardianName ||
    student.guardianName ||
    student.guardianContactId
  ) {
    const guardianId = guardians.guardianContactId
      ? String(guardians.guardianContactId)
      : student.guardianContactId
        ? String(student.guardianContactId)
        : undefined;
    const guardianName = guardians.guardianName || student.guardianName || undefined;
    addRelationshipItem(guardianId, guardianName, STUDENT_GUARDIAN_RELATIONSHIP_LABEL);
  }

  return results;
}

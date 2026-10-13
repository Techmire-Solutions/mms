import {
  resolveStudentGuardianLinks,
  STUDENT_DETAIL_HERO_FIELD_KEYS,
  OBSOLETE_STUDENT_GUARDIAN_FIELD_KEYS,
  STUDENTS_MODULE_MANIFEST,
  type Student,
  type StudentContactRelationshipLink,
  calcAge,
  getPrimaryPhone,
  getPrimaryEmail,
  hasWhatsApp,
} from "@mms/shared";
import { useMemo } from "react";
import { useSessions, useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useContactsByIds, useContactById } from "@/tenant/hooks/collections/contacts";
import { useStudentsContractList } from "@/tenant/features/students/hooks/useStudentsTsrHooks";
import { useStudentConfig } from "@/hooks/useStandardModuleConfig";
import { useTranslation } from "@/hooks/useTranslation";
import { studentStatusBadgeConfig } from "@/lib/students/studentStatusUi";
import type { SiblingStudentItem } from "@/tenant/features/students/components/StudentDetailSiblingsSection";
import { buildStudentSortedEnabledFields } from "@/tenant/features/students/lib/studentDetailSortedFields";
import { buildStudentContactProfile } from "@/tenant/features/students/lib/studentDetailContactProfile";
import { buildStudentRelationships } from "@/tenant/features/students/lib/studentDetailRelationships";
import { buildStudentSiblings } from "@/tenant/features/students/lib/studentDetailSiblingMatch";

/** Detail drawer model: contact hydration, profile blocks, relationships, field config, siblings. */
export function useStudentDetailModel(student: Student) {
  const { t } = useTranslation();
  const statusBadgeConfig = studentStatusBadgeConfig(t);
  const sessionsQuery = useSessions();
  const sessions = useSessionsCollection();

  const { data: primaryContact } = useContactById(
    student.contactId != null ? String(student.contactId) : undefined,
  );

  const guardians = useMemo(
    () => resolveStudentGuardianLinks(student, primaryContact ?? null),
    [student, primaryContact],
  );

  const linkedIds = useMemo(() => {
    const ids = new Set<string>();
    if (student.contactId != null && String(student.contactId).trim()) {
      ids.add(String(student.contactId).trim());
    }
    if (student.fatherContactId != null && String(student.fatherContactId).trim()) {
      ids.add(String(student.fatherContactId).trim());
    }
    if (student.guardianContactId != null && String(student.guardianContactId).trim()) {
      ids.add(String(student.guardianContactId).trim());
    }
    if (guardians.fatherContactId) ids.add(String(guardians.fatherContactId).trim());
    if (guardians.guardianContactId) ids.add(String(guardians.guardianContactId).trim());

    for (const rel of primaryContact?.relationshipContacts ?? []) {
      if (rel.contactId != null && String(rel.contactId).trim()) {
        ids.add(String(rel.contactId).trim());
      }
    }
    for (const rel of primaryContact?.relationships ?? []) {
      if (rel.contactId != null && String(rel.contactId).trim()) {
        ids.add(String(rel.contactId).trim());
      }
    }

    return Array.from(ids);
  }, [
    student.contactId,
    student.fatherContactId,
    student.guardianContactId,
    guardians.fatherContactId,
    guardians.guardianContactId,
    primaryContact?.relationshipContacts,
    primaryContact?.relationships,
  ]);

  const contactsQuery = useContactsByIds(linkedIds);
  const contactList = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data]);

  const studentContact = useMemo(() => {
    return (
      contactList.find((c) => String(c.id) === String(student.contactId)) ??
      primaryContact ??
      undefined
    );
  }, [contactList, student.contactId, primaryContact]);

  const { settings } = useStudentConfig();
  const sortedEnabledFields = buildStudentSortedEnabledFields(settings, t);

  const { profile: studentContactProfile } = buildStudentContactProfile(student, studentContact, t);

  const emptyDash = t("students.table.emptyDash");
  const hydratedRelationships = buildStudentRelationships({
    student,
    studentContact,
    contactList,
    guardians,
    t,
    emptyDash,
  });

  const age = calcAge(student.dob || studentContact?.dob);
  const enrolledSessionDetails = useMemo(() => {
    const enrolledSet = new Set(student.enrolledSessions ?? []);
    return sessions.filter((session) => enrolledSet.has(session.id));
  }, [student.enrolledSessions, sessions]);

  const primaryPhone = (studentContact ? getPrimaryPhone(studentContact) : null) || student.phone;
  const primaryEmail = (studentContact ? getPrimaryEmail(studentContact) : null) || student.email;

  const hasVisibleDetailFields = sortedEnabledFields.some((field) => {
    if (
      STUDENT_DETAIL_HERO_FIELD_KEYS.has(field.key) ||
      OBSOLETE_STUDENT_GUARDIAN_FIELD_KEYS.has(field.key)
    ) {
      return false;
    }
    if (field.key === "contactRelationships") {
      return hydratedRelationships.length > 0;
    }
    return true;
  });

  const siblingRelatedContactIds = useMemo(
    () =>
      Array.from(
        new Set(
          [
            guardians.fatherContactId ? String(guardians.fatherContactId) : "",
            guardians.guardianContactId ? String(guardians.guardianContactId) : "",
          ].filter(Boolean),
        ),
      ),
    [guardians.fatherContactId, guardians.guardianContactId],
  );
  const siblingFatherName = (guardians.fatherName || student.fatherName || "").trim();
  const hasSiblingLookup = siblingRelatedContactIds.length > 0 || Boolean(siblingFatherName);
  const siblingQueryParams = useMemo(
    () => ({
      page: 1,
      limit: STUDENTS_MODULE_MANIFEST.maxPageSize,
      relatedContactIds: siblingRelatedContactIds.join(",") || undefined,
      fatherName: siblingFatherName || undefined,
      excludeId: student.id ? String(student.id) : undefined,
    }),
    [siblingRelatedContactIds, siblingFatherName, student.id],
  );
  const allStudentsQuery = useStudentsContractList(siblingQueryParams, hasSiblingLookup);
  const allStudents = getStudentsFromPage(allStudentsQuery.data?.body);

  const siblings: SiblingStudentItem[] = buildStudentSiblings(
    student,
    guardians,
    allStudents,
    sessions,
  );

  const showNotesSection =
    Boolean(student.notes) && sortedEnabledFields.some((field) => field.key === "notes");

  /** O(1) lookup map for sibling navigation — avoids .find() on every click. */
  const siblingMap = useMemo(
    () => new Map(allStudents.map((s) => [String(s.id), s])),
    [allStudents],
  );

  const legacyRelationshipLinks: StudentContactRelationshipLink[] = useMemo(() => {
    return hydratedRelationships.map((r) => ({
      contactId: r.contactId,
      name: r.name,
      phone: r.phones[0]?.number,
      email: r.emails[0]?.address,
      gender: r.gender,
      relationship: r.relationship,
    }));
  }, [hydratedRelationships]);

  return {
    t,
    statusBadgeConfig,
    sortedEnabledFields,
    relationshipLinks: legacyRelationshipLinks,
    hydratedRelationships,
    studentContact,
    studentContactProfile,
    age,
    enrolledSessionDetails,
    sessionsLoading: sessionsQuery.isLoading,
    sessionsError: sessionsQuery.isError,
    primaryPhone,
    primaryEmail,
    hasWhatsAppContact: hasWhatsApp({ phone: primaryPhone ?? undefined }),
    hasVisibleDetailFields,
    showNotesSection,
    siblings,
    siblingMap,
    allStudents,
  };
}
/** Contract list pages are union-shaped at classification-failure sites — narrow to the students array. */
function getStudentsFromPage(body: unknown): Student[] {
  return (body as { students?: Student[] } | null)?.students ?? [];
}

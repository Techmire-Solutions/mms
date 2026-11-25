import { hasWhatsApp, type Faculty } from "@mms/contracts";
import { useFacultyConfig } from "./useFacultyConfig";
import { resolveFacultyPrimaryChannels } from "../lib/facultyPrimaryChannels";
import { useContactById } from "../host/contacts";
import { useSessions, useSessionsCollection } from "../host/sessions";
import { useFacultyStatusConfig } from "./useFacultyStatusConfig";
import { listFacultyDetailAttributeFields } from "../lib/facultyDetailFields";
import { getFacultyAssignedClasses, type FacultyAssignedClassItem } from "../lib/facultyAssignment";

/** Faculty detail drawer model — mirrors useStudentDetailModel (Students parity). */
export function useFacultyDetailModel(faculty: Faculty) {
  const { settings } = useFacultyConfig();
  const statusConfig = useFacultyStatusConfig();
  const { data: linkedContact } = useContactById(
    faculty.contactId != null ? String(faculty.contactId) : undefined,
    Boolean(faculty.contactId),
  );
  const sessionsQuery = useSessions();
  const sessions = useSessionsCollection();

  const assignedClasses: FacultyAssignedClassItem[] = faculty.id
    ? getFacultyAssignedClasses(faculty.id, sessions)
    : [];

  const detailFields = listFacultyDetailAttributeFields(settings);

  const { phone: primaryPhone, email: primaryEmail } = resolveFacultyPrimaryChannels(
    faculty,
    linkedContact,
  );

  // `status` renders in the hero badge and `notes` in its own section — neither
  // counts as a visible attribute row; contact-owned gender/channels render as
  // their own rows when present, so any of those also make the card render.
  const hasVisibleDetailFields =
    detailFields.some((field) => field.key !== "status" && field.key !== "notes") ||
    Boolean(faculty.gender) ||
    Boolean(primaryPhone) ||
    Boolean(primaryEmail);

  return {
    statusConfig,
    detailFields,
    linkedContact,
    primaryPhone,
    primaryEmail,
    // Gate on the number actually used for the WhatsApp recipient so gate ≡ recipient.
    hasWhatsAppContact: hasWhatsApp({ phone: primaryPhone ?? undefined }),
    hasVisibleDetailFields,
    assignedClasses,
    sessionsLoading: sessionsQuery.isLoading,
    sessionsError: sessionsQuery.isError,
  };
}

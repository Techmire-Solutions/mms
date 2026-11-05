import type { Session } from "@/lib/data/sessionsData";

export const COMMON_FACULTY_ROLES = [
  "Head Instructor",
  "Lead Instructor",
  "Assistant Instructor",
  "Department Head",
  "Academic Coordinator",
  "Tajweed Supervisor",
  "Examiner",
  "Administrator",
];

export interface FacultyManagementTabProps {
  session: Session;
  onUpdate: (updatedSession: Session) => void | Promise<void>;
  /** Writable flag (detail passes both names; `canMutate` wins for older callers). */
  canWrite?: boolean;
  canMutate?: boolean;
}

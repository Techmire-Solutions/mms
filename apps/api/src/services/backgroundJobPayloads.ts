import type {
  ContactExportColumn,
  EnrollmentExportColumn,
  FacultyExportColumn,
  MessagingCsvExportQueryDto,
  SessionExportColumn,
  StudentExportColumn,
} from "@mms/contracts";
import type { ContactsExportQueryInput } from "@mms/mod-contacts/backend/use-cases";
import type { StudentsExportQueryInput } from "@mms/mod-students/backend/services";
import type { FacultyExportQueryInput } from "@mms/mod-faculty/backend/services";
import type { SessionsExportQueryInput } from "@mms/mod-sessions/backend/services";
import type { EnrollmentsExportQueryInput } from "@mms/mod-enrollments/backend/services";

export interface ContactsExportJobPayload {
  query?: ContactsExportQueryInput;
  columns?: ContactExportColumn[];
  filename?: string;
  label?: string;
  viewerRole: string;
  /** Enqueue-time privilege — runner must not honor includeDeleted without this. */
  allowDeleted?: boolean;
}

export interface ContactsVcfExportJobPayload {
  filename?: string;
  label?: string;
  /**
   * Enqueue-time viewer role. The runner sanitizes each page before `toVCard`
   * (C-05); optional so jobs queued before this field existed still complete,
   * and an empty role still hides non-empty field permissions.
   */
  viewerRole?: string;
}

export interface StudentsExportJobPayload {
  query?: StudentsExportQueryInput;
  columns?: StudentExportColumn[];
  filename?: string;
  label?: string;
  viewerRole: string;
  allowDeleted?: boolean;
}

export interface SessionsExportJobPayload {
  query?: SessionsExportQueryInput;
  columns?: SessionExportColumn[];
  filename?: string;
  label?: string;
  viewerRole: string;
  allowDeleted?: boolean;
}

export interface FacultyExportJobPayload {
  query?: FacultyExportQueryInput;
  columns?: FacultyExportColumn[];
  filename?: string;
  label?: string;
  viewerRole: string;
  allowDeleted?: boolean;
}

export interface EnrollmentsExportJobPayload {
  query?: EnrollmentsExportQueryInput;
  columns?: EnrollmentExportColumn[];
  filename?: string;
  label?: string;
  viewerRole: string;
  allowDeleted?: boolean;
}

export interface MessagingExportJobPayload {
  query?: MessagingCsvExportQueryDto;
  filename?: string;
  label?: string;
}

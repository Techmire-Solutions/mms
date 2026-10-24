import type {
  ContactExportColumn,
  EnrollmentExportColumn,
  FacultyExportColumn,
  MessagingCsvExportQueryDto,
  SessionExportColumn,
  StudentExportColumn,
} from "@mms/shared";
import type { ContactsExportQueryInput } from "../contacts/use-cases/contactExportUseCases.js";
import type { StudentsExportQueryInput } from "./studentsExportService.js";
import type { FacultyExportQueryInput } from "./facultyExportService.js";
import type { SessionsExportQueryInput } from "./sessionsExportService.js";
import type { EnrollmentsExportQueryInput } from "./enrollmentsExportService.js";

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

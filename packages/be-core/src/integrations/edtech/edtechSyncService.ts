/**
 * EdTech Directory Sync Service Blueprint & Contracts
 * Supporting OneRoster 1.2 REST, Google Classroom, and Clever.
 */

export type EdTechProvider = "oneroster" | "google_classroom" | "clever";

export const EXTERNAL_SYNC_SOURCE = "external_sync";

export interface EdTechStudentSyncDto {
  sourcedId: string;
  givenName: string;
  familyName: string;
  email?: string;
  identifier?: string;
  gender?: string;
  dateOfBirth?: string;
  gradeLevel?: string;
  status: "active" | "inactive" | "tobedeleted";
  metadata?: Record<string, unknown>;
}

export interface EdTechSyncResult {
  provider: EdTechProvider;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors?: Array<{ sourcedId: string; reason: string }>;
}

export interface EdTechSyncOptions {
  tenant: string;
  provider: EdTechProvider;
  dryRun?: boolean;
  signal?: AbortSignal;
}

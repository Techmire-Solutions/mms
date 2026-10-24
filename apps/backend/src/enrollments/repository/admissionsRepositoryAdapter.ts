import type { AdmissionsRepository } from "./admissionsRepository.js";
import {
  admissionsMetricsTx,
  countLinkSubmissionsTx,
  findApplicationsByIdsTx,
  findMatchingStudentIdsTx,
  insertApplicationTx,
  listApplicationsTx,
  updateApplicationTx,
} from "../../db/repositories/registrationApplicationRepository.js";
import {
  findRegistrationLinkBySlugTx,
  listActiveRegistrationLinksTx,
  lockRegistrationLinkTx,
} from "../../db/repositories/registrationLinkRepository.js";
import { findSessionById } from "../../db/repositories/sessionRepositoryQueries.js";
import { findWorkspaceTimezone } from "../../db/repositories/workspaceRepository.js";
import { findStudentsByIds } from "../../db/repositories/studentRepositoryHydrate.js";
import { bulkSaveEnrollments } from "../../db/repositories/enrollmentRepositoryPersist.js";
import {
  cancelStudentEnrollmentsInSession,
  findActivelyEnrolledStudentIds,
} from "../../db/repositories/enrollmentBulkOps.js";
import { findLatestEnrollmentId } from "../../db/repositories/enrollmentPlacementLookup.js";
import { flagOldestWaitlistedApplication } from "../../db/repositories/registrationWaitlistRepository.js";

/** Drizzle-backed adapter for {@link AdmissionsRepository}. */
export const admissionsRepository: AdmissionsRepository = {
  listApplicationsTx,
  findApplicationsByIdsTx,
  countLinkSubmissionsTx,
  admissionsMetricsTx,
  updateApplicationTx,
  findMatchingStudentIdsTx,
  insertApplicationTx,
  findRegistrationLinkBySlugTx,
  listActiveRegistrationLinksTx,
  lockRegistrationLinkTx,
  findSessionById,
  findWorkspaceTimezone,
  findStudentsByIds,
  bulkSaveEnrollments,
  findActivelyEnrolledStudentIds,
  cancelStudentEnrollmentsInSession,
  findLatestEnrollmentId,
  flagOldestWaitlistedApplication,
};

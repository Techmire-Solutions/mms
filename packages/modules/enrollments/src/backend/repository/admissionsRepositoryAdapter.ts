import type { AdmissionsRepository } from "./admissionsRepository.js";
import {
  admissionsMetricsTx,
  countLinkSubmissionsTx,
  findApplicationsByIdsTx,
  findMatchingStudentIdsTx,
  insertApplicationTx,
  listApplicationsTx,
  updateApplicationTx,
} from "../repository/db/registrationApplicationRepository.js";
import {
  findRegistrationLinkBySlugTx,
  listActiveRegistrationLinksTx,
  lockRegistrationLinkTx,
} from "../deps.js";
import { findSessionById, findSessionsByIds } from "../deps.js";
import { findWorkspaceTimezone } from "../deps.js";
import { findStudentsByIds } from "../deps.js";
import { bulkSaveEnrollments } from "../repository/db/enrollmentRepositoryPersist.js";
import { findActivelyEnrolledStudentIds } from "../repository/db/enrollmentBulkOps.js";
import { findLatestEnrollmentId } from "../repository/db/enrollmentPlacementLookup.js";
import {
  classHasFreeSeat,
  flagOldestWaitlistedApplication,
  revertExpiredWaitlistOffers,
  revertSeatOffersForClass,
} from "../repository/db/registrationWaitlistRepository.js";
import { getEnrollmentModulePreferencesByWorkspace } from "../repository/db/enrollmentModulePreferencesRepository.js";

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
  findSessionsByIds,
  findWorkspaceTimezone,
  findStudentsByIds,
  bulkSaveEnrollments,
  findActivelyEnrolledStudentIds,
  findLatestEnrollmentId,
  flagOldestWaitlistedApplication,
  revertExpiredWaitlistOffers,
  revertSeatOffersForClass,
  classHasFreeSeat,
  getEnrollmentModulePreferencesByWorkspace,
};

type ApplicationStore = typeof import("../repository/db/registrationApplicationRepository.js");
type LinkStore = typeof import("../deps.js");
type SessionQueries = typeof import("../deps.js");
type WorkspaceStore = typeof import("../deps.js");
type StudentHydrate = typeof import("../deps.js");
type EnrollmentPersist = typeof import("../repository/db/enrollmentRepositoryPersist.js");
type EnrollmentBulkOps = typeof import("../repository/db/enrollmentBulkOps.js");
type WaitlistStore = typeof import("../repository/db/registrationWaitlistRepository.js");
type PlacementStore = typeof import("../repository/db/enrollmentPlacementLookup.js");
type PreferencesStore = typeof import("../repository/db/enrollmentModulePreferencesRepository.js");

export type { ApplicationJoinedRow } from "../repository/db/registrationApplicationRepository.js";

/**
 * Storage gateway for Enrollments admissions: public registration applications, their review,
 * and the bulk enrollment path approval runs through.
 */
export interface AdmissionsRepository {
  listApplicationsTx: ApplicationStore["listApplicationsTx"];
  findApplicationsByIdsTx: ApplicationStore["findApplicationsByIdsTx"];
  countLinkSubmissionsTx: ApplicationStore["countLinkSubmissionsTx"];
  admissionsMetricsTx: ApplicationStore["admissionsMetricsTx"];
  updateApplicationTx: ApplicationStore["updateApplicationTx"];
  findMatchingStudentIdsTx: ApplicationStore["findMatchingStudentIdsTx"];
  insertApplicationTx: ApplicationStore["insertApplicationTx"];
  findRegistrationLinkBySlugTx: LinkStore["findRegistrationLinkBySlugTx"];
  listActiveRegistrationLinksTx: LinkStore["listActiveRegistrationLinksTx"];
  lockRegistrationLinkTx: LinkStore["lockRegistrationLinkTx"];
  findSessionById: SessionQueries["findSessionById"];
  findSessionsByIds: SessionQueries["findSessionsByIds"];
  findWorkspaceTimezone: WorkspaceStore["findWorkspaceTimezone"];
  findStudentsByIds: StudentHydrate["findStudentsByIds"];
  bulkSaveEnrollments: EnrollmentPersist["bulkSaveEnrollments"];
  findActivelyEnrolledStudentIds: EnrollmentBulkOps["findActivelyEnrolledStudentIds"];
  findLatestEnrollmentId: PlacementStore["findLatestEnrollmentId"];
  flagOldestWaitlistedApplication: WaitlistStore["flagOldestWaitlistedApplication"];
  revertExpiredWaitlistOffers: WaitlistStore["revertExpiredWaitlistOffers"];
  revertSeatOffersForClass: WaitlistStore["revertSeatOffersForClass"];
  classHasFreeSeat: WaitlistStore["classHasFreeSeat"];
  getEnrollmentModulePreferencesByWorkspace: PreferencesStore["getEnrollmentModulePreferencesByWorkspace"];
}

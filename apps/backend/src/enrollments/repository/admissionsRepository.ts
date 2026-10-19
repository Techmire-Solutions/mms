type ApplicationStore = typeof import("../../db/repositories/registrationApplicationRepository.js");
type LinkStore = typeof import("../../db/repositories/registrationLinkRepository.js");
type SessionQueries = typeof import("../../db/repositories/sessionRepositoryQueries.js");
type WorkspaceStore = typeof import("../../db/repositories/workspaceRepository.js");
type StudentHydrate = typeof import("../../db/repositories/studentRepositoryHydrate.js");
type EnrollmentPersist = typeof import("../../db/repositories/enrollmentRepositoryPersist.js");
type EnrollmentBulkOps = typeof import("../../db/repositories/enrollmentBulkOps.js");
type WaitlistStore = typeof import("../../db/repositories/registrationWaitlistRepository.js");
type PlacementStore = typeof import("../../db/repositories/enrollmentPlacementLookup.js");

export type { ApplicationJoinedRow } from "../../db/repositories/registrationApplicationRepository.js";

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
  findWorkspaceTimezone: WorkspaceStore["findWorkspaceTimezone"];
  findStudentsByIds: StudentHydrate["findStudentsByIds"];
  bulkSaveEnrollments: EnrollmentPersist["bulkSaveEnrollments"];
  findActivelyEnrolledStudentIds: EnrollmentBulkOps["findActivelyEnrolledStudentIds"];
  cancelStudentEnrollmentsInSession: EnrollmentBulkOps["cancelStudentEnrollmentsInSession"];
  findLatestEnrollmentId: PlacementStore["findLatestEnrollmentId"];
  flagOldestWaitlistedApplication: WaitlistStore["flagOldestWaitlistedApplication"];
}

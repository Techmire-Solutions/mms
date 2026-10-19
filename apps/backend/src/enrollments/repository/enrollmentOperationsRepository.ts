type OperationsStore = typeof import("../../db/repositories/enrollmentOperationsRepository.js");
type EnrollmentHydrate = typeof import("../../db/repositories/enrollmentRepositoryHydrate.js");
type SessionQueries = typeof import("../../db/repositories/sessionRepositoryQueries.js");
type PreferencesStore =
  typeof import("../../db/repositories/enrollmentModulePreferencesRepository.js");
type StudentHydrate = typeof import("../../db/repositories/studentRepositoryHydrate.js");
type WorkspaceStore = typeof import("../../db/repositories/workspaceRepository.js");

export type {
  EndedEnrollmentStatus,
  LiveEnrollmentRow,
  OperationActor,
} from "../../db/repositories/enrollmentOperationsRepository.js";

/** Storage gateway for mid-session enrollment operations (transfer, withdrawal, placements). */
export interface EnrollmentOperationsRepository {
  findEnrollmentById: EnrollmentHydrate["findEnrollmentById"];
  findSessionById: SessionQueries["findSessionById"];
  getEnrollmentModulePreferencesByWorkspace: PreferencesStore["getEnrollmentModulePreferencesByWorkspace"];
  findWorkspaceTimezone: WorkspaceStore["findWorkspaceTimezone"];
  findStudentsByIds: StudentHydrate["findStudentsByIds"];
  listEnrollmentPlacements: OperationsStore["listEnrollmentPlacements"];
  applyEnrollmentTransfer: OperationsStore["applyEnrollmentTransfer"];
  applyEnrollmentWithdrawal: OperationsStore["applyEnrollmentWithdrawal"];
  listLiveEnrollments: OperationsStore["listLiveEnrollments"];
  applyEnrollmentReadmission: OperationsStore["applyEnrollmentReadmission"];
  recordEnrollmentSuspension: OperationsStore["recordEnrollmentSuspension"];
}

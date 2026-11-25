type OperationsStore = typeof import("../repository/db/enrollmentOperationsRepository.js");
type EnrollmentHydrate = typeof import("../repository/db/enrollmentRepositoryHydrate.js");
type SessionQueries = typeof import("../deps.js");
type PreferencesStore = typeof import("../repository/db/enrollmentModulePreferencesRepository.js");
type SessionPreferencesStore = typeof import("../deps.js");
type StudentHydrate = typeof import("../deps.js");
type WorkspaceStore = typeof import("../deps.js");

export type {
  EndedEnrollmentStatus,
  LiveEnrollmentRow,
  OperationActor,
} from "../repository/db/enrollmentOperationsRepository.js";

/** Storage gateway for mid-session enrollment operations (transfer, withdrawal, placements). */
export interface EnrollmentOperationsRepository {
  findEnrollmentById: EnrollmentHydrate["findEnrollmentById"];
  findSessionById: SessionQueries["findSessionById"];
  getEnrollmentModulePreferencesByWorkspace: PreferencesStore["getEnrollmentModulePreferencesByWorkspace"];
  getSessionModulePreferencesByWorkspace: SessionPreferencesStore["getSessionModulePreferencesByWorkspace"];
  findWorkspaceTimezone: WorkspaceStore["findWorkspaceTimezone"];
  findStudentsByIds: StudentHydrate["findStudentsByIds"];
  listEnrollmentPlacements: OperationsStore["listEnrollmentPlacements"];
  applyEnrollmentTransfer: OperationsStore["applyEnrollmentTransfer"];
  applyEnrollmentWithdrawal: OperationsStore["applyEnrollmentWithdrawal"];
  bulkApplyEnrollmentWithdrawal: OperationsStore["bulkApplyEnrollmentWithdrawal"];
  listOperableEnrollments: OperationsStore["listOperableEnrollments"];
  /** Live seat counts per class/section, used to validate rollover quota under a lock. */
  countLiveSeatsByClassTx: OperationsStore["countLiveSeatsByClassTx"];
  /** Serialises rollover quota checks for one target session. */
  lockRolloverCarryTx: OperationsStore["lockRolloverCarryTx"];
  applyEnrollmentReadmission: OperationsStore["applyEnrollmentReadmission"];
  recordEnrollmentSuspension: OperationsStore["recordEnrollmentSuspension"];
}

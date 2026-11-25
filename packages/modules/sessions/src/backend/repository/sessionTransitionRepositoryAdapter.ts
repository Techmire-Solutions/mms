/**
 * Port for the session transition service: keeps the use-cases free of `db/repositories` imports
 * (`SYSTEM_ARCHITECTURE.md` §5 ports & adapters).
 */
export {
  countLiveEnrollmentsTx,
  countSessionAttendanceTx,
  countSessionExamResultsTx,
  lockSessionForTransitionTx,
  sessionDateBoundsTx,
  sessionHasBudgetTx,
  shiftSessionDependentDatesTx,
  updateSessionStatusIfTx,
} from "../repository/db/sessionTransitionRepository.js";

export { getSessionModulePreferencesByWorkspace } from "../repository/db/sessionModulePreferencesRepository.js";

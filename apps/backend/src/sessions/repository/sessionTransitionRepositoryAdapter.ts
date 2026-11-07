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
} from "../../db/repositories/sessionTransitionRepository.js";

export { getSessionModulePreferencesByWorkspace } from "../../db/repositories/sessionModulePreferencesRepository.js";

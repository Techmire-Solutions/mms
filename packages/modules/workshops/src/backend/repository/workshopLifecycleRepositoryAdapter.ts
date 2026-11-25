/**
 * Port for the workshop lifecycle service: keeps the use-cases free of `db/repositories` imports
 * (`SYSTEM_ARCHITECTURE.md` §5 ports & adapters, same seam as
 * `sessions/repository/sessionTransitionRepositoryAdapter.ts`).
 */
export {
  archiveWorkshopRegistrationsTx,
  countCertificatesTx,
  countLiveParticipantsTx,
  lockWorkshopTx,
  updateWorkshopStatusIfTx,
  type ArchivedRegistration,
  type WorkshopRow,
} from "../repository/workshopTransitionRepository.js";

export {
  markCertificatesIssuedTx,
  saveCompletionOutcomesTx,
} from "../repository/workshopEvaluationRepository.js";

export { countActiveParticipantsByWorkshop } from "../repository/workshopParticipantsRepository.js";

export { loadCompletionInputs } from "../repository/workshopCompletionRepository.js";

export { workshopRowToRecord } from "../repository/workshopEventMapping.js";

export { workshopToday } from "../repository/workshopClock.js";

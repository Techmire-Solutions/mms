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
} from "../../db/repositories/workshopTransitionRepository.js";

export {
  markCertificatesIssuedTx,
  saveCompletionOutcomesTx,
} from "../../db/repositories/workshopEvaluationRepository.js";

export { countActiveParticipantsByWorkshop } from "../../db/repositories/workshopParticipantsRepository.js";

export { loadCompletionInputs } from "../../db/repositories/workshopCompletionRepository.js";

export { workshopRowToRecord } from "../../db/repositories/workshopEventMapping.js";

export { workshopToday } from "../../db/repositories/workshopClock.js";

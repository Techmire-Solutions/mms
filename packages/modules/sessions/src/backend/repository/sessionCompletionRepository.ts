type CompletionStore = typeof import("../repository/db/sessionCompletionRepository.js");
type GateStore = typeof import("../repository/db/sessionCompletionGateRepository.js");

export type { CompletionFactRow } from "../repository/db/sessionCompletionRepository.js";
export type { CompletionGateRow } from "../repository/db/sessionCompletionGateRepository.js";

/** Storage gateway for short-course completion and certificates. */
export interface SessionCompletionRepository {
  loadSessionCompletionFacts: CompletionStore["loadSessionCompletionFacts"];
  saveCompletionOutcomes: CompletionStore["saveCompletionOutcomes"];
  markCertificatesIssued: CompletionStore["markCertificatesIssued"];
  markCompletionEvaluated: CompletionStore["markCompletionEvaluated"];
  /** Finalisation gates: unmarked attendance, unfinalized exams, dues, staleness. */
  loadCompletionGates: GateStore["loadCompletionGates"];
}

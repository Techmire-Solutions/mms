type CompletionStore = typeof import("../../db/repositories/sessionCompletionRepository.js");
type GateStore = typeof import("../../db/repositories/sessionCompletionGateRepository.js");

export type { CompletionFactRow } from "../../db/repositories/sessionCompletionRepository.js";
export type { CompletionGateRow } from "../../db/repositories/sessionCompletionGateRepository.js";

/** Storage gateway for short-course completion and certificates. */
export interface SessionCompletionRepository {
  loadSessionCompletionFacts: CompletionStore["loadSessionCompletionFacts"];
  saveCompletionOutcomes: CompletionStore["saveCompletionOutcomes"];
  markCertificatesIssued: CompletionStore["markCertificatesIssued"];
  markCompletionEvaluated: CompletionStore["markCompletionEvaluated"];
  /** Finalisation gates: unmarked attendance, unfinalized exams, dues, staleness. */
  loadCompletionGates: GateStore["loadCompletionGates"];
}

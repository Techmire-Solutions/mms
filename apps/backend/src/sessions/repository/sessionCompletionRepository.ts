type CompletionStore = typeof import("../../db/repositories/sessionCompletionRepository.js");

export type { CompletionFactRow } from "../../db/repositories/sessionCompletionRepository.js";

/** Storage gateway for short-course completion and certificates. */
export interface SessionCompletionRepository {
  loadSessionCompletionFacts: CompletionStore["loadSessionCompletionFacts"];
  saveCompletionOutcomes: CompletionStore["saveCompletionOutcomes"];
  markCertificatesIssued: CompletionStore["markCertificatesIssued"];
}

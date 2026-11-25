import type { SessionCompletionRepository } from "./sessionCompletionRepository.js";
import {
  loadSessionCompletionFacts,
  markCertificatesIssued,
  markCompletionEvaluated,
  saveCompletionOutcomes,
} from "../repository/db/sessionCompletionRepository.js";
import { loadCompletionGates } from "../repository/db/sessionCompletionGateRepository.js";

export const sessionCompletionRepository: SessionCompletionRepository = {
  loadSessionCompletionFacts,
  saveCompletionOutcomes,
  markCertificatesIssued,
  markCompletionEvaluated,
  loadCompletionGates,
};

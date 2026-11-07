import type { SessionCompletionRepository } from "./sessionCompletionRepository.js";
import {
  loadSessionCompletionFacts,
  markCertificatesIssued,
  markCompletionEvaluated,
  saveCompletionOutcomes,
} from "../../db/repositories/sessionCompletionRepository.js";
import { loadCompletionGates } from "../../db/repositories/sessionCompletionGateRepository.js";

export const sessionCompletionRepository: SessionCompletionRepository = {
  loadSessionCompletionFacts,
  saveCompletionOutcomes,
  markCertificatesIssued,
  markCompletionEvaluated,
  loadCompletionGates,
};

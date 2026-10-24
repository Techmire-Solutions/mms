import type { SessionCompletionRepository } from "./sessionCompletionRepository.js";
import {
  loadSessionCompletionFacts,
  markCertificatesIssued,
  saveCompletionOutcomes,
} from "../../db/repositories/sessionCompletionRepository.js";

export const sessionCompletionRepository: SessionCompletionRepository = {
  loadSessionCompletionFacts,
  saveCompletionOutcomes,
  markCertificatesIssued,
};

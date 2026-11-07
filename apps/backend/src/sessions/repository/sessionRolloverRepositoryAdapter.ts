import type { SessionRolloverRepository } from "./sessionRolloverRepository.js";
import {
  createPromotionRun,
  findPromotedSourceIds,
  findPromotionRun,
  incrementPromotionRunCounts,
  listPromotionRuns,
  updatePromotionRun,
} from "../../db/repositories/sessionPromotionRepository.js";
import {
  claimPromotionRun,
  failStaleRuns,
  findPromotionRunForUpdate,
  listRunWarnings,
  recordRunWarning,
  readPromotionRunCounts,
} from "../../db/repositories/sessionPromotionRunExecutionRepository.js";

export const sessionRolloverRepository: SessionRolloverRepository = {
  createPromotionRun,
  updatePromotionRun,
  incrementPromotionRunCounts,
  findPromotionRun,
  listPromotionRuns,
  findPromotedSourceIds,
  claimPromotionRun,
  failStaleRuns,
  findPromotionRunForUpdate,
  recordRunWarning,
  listRunWarnings,
  readPromotionRunCounts,
};

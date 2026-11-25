import type { SessionRolloverRepository } from "./sessionRolloverRepository.js";
import {
  createPromotionRun,
  findPromotedSourceIds,
  findPromotionRun,
  listPromotionRuns,
  setPromotionRunCounts,
  updatePromotionRun,
} from "../repository/db/sessionPromotionRepository.js";
import {
  claimPromotionRun,
  failStaleRuns,
  findPromotionRunForUpdate,
  listRunWarnings,
  recordRunWarning,
  readPromotionRunCounts,
} from "../repository/db/sessionPromotionRunExecutionRepository.js";

export const sessionRolloverRepository: SessionRolloverRepository = {
  createPromotionRun,
  updatePromotionRun,
  setPromotionRunCounts,
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

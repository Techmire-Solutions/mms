import type { SessionRolloverRepository } from "./sessionRolloverRepository.js";
import {
  createPromotionRun,
  findPromotedSourceIds,
  findPromotionRun,
  listPromotionRuns,
  updatePromotionRun,
} from "../../db/repositories/sessionPromotionRepository.js";
import {
  claimPromotionRun,
  failStaleRuns,
  findPromotionRunForUpdate,
  listRunWarnings,
  recordRunWarning,
} from "../../db/repositories/sessionPromotionRunExecutionRepository.js";

export const sessionRolloverRepository: SessionRolloverRepository = {
  createPromotionRun,
  updatePromotionRun,
  findPromotionRun,
  listPromotionRuns,
  findPromotedSourceIds,
  claimPromotionRun,
  failStaleRuns,
  findPromotionRunForUpdate,
  recordRunWarning,
  listRunWarnings,
};

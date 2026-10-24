import type { SessionRolloverRepository } from "./sessionRolloverRepository.js";
import {
  createPromotionRun,
  findPromotedSourceIds,
  findPromotionRun,
  listPromotionRuns,
  updatePromotionRun,
} from "../../db/repositories/sessionPromotionRepository.js";

export const sessionRolloverRepository: SessionRolloverRepository = {
  createPromotionRun,
  updatePromotionRun,
  findPromotionRun,
  listPromotionRuns,
  findPromotedSourceIds,
};

type PromotionStore = typeof import("../../db/repositories/sessionPromotionRepository.js");

/** Storage gateway for session rollover runs (duplicate / promote). */
export interface SessionRolloverRepository {
  createPromotionRun: PromotionStore["createPromotionRun"];
  updatePromotionRun: PromotionStore["updatePromotionRun"];
  findPromotionRun: PromotionStore["findPromotionRun"];
  listPromotionRuns: PromotionStore["listPromotionRuns"];
  findPromotedSourceIds: PromotionStore["findPromotedSourceIds"];
}

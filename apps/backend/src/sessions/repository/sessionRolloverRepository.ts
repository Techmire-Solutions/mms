type PromotionStore = typeof import("../../db/repositories/sessionPromotionRepository.js");
type PromotionExecutionStore =
  typeof import("../../db/repositories/sessionPromotionRunExecutionRepository.js");

/** Storage gateway for session rollover runs (duplicate / promote). */
export interface SessionRolloverRepository {
  createPromotionRun: PromotionStore["createPromotionRun"];
  updatePromotionRun: PromotionStore["updatePromotionRun"];
  incrementPromotionRunCounts: PromotionStore["incrementPromotionRunCounts"];
  findPromotionRun: PromotionStore["findPromotionRun"];
  listPromotionRuns: PromotionStore["listPromotionRuns"];
  findPromotedSourceIds: PromotionStore["findPromotedSourceIds"];
  /** Execution control: claim, phase resume, stale recovery and non-fatal copy warnings. */
  claimPromotionRun: PromotionExecutionStore["claimPromotionRun"];
  failStaleRuns: PromotionExecutionStore["failStaleRuns"];
  findPromotionRunForUpdate: PromotionExecutionStore["findPromotionRunForUpdate"];
  recordRunWarning: PromotionExecutionStore["recordRunWarning"];
  readPromotionRunCounts: PromotionExecutionStore["readPromotionRunCounts"];
  listRunWarnings: PromotionExecutionStore["listRunWarnings"];
}

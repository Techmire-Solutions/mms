type PromotionStore = typeof import("../repository/db/sessionPromotionRepository.js");
type PromotionExecutionStore =
  typeof import("../repository/db/sessionPromotionRunExecutionRepository.js");

/** Storage gateway for session rollover runs (duplicate / promote). */
export interface SessionRolloverRepository {
  createPromotionRun: PromotionStore["createPromotionRun"];
  updatePromotionRun: PromotionStore["updatePromotionRun"];
  setPromotionRunCounts: PromotionStore["setPromotionRunCounts"];
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

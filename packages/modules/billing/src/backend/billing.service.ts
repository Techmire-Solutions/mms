import { registerFinanceJobRunners } from "./jobs/backgroundJobFinanceRunners.js";

/** Registers the finance background-job runners (called by the app composition root). */
export function createBillingService(): { registerJobRunners: () => void } {
  return { registerJobRunners: registerFinanceJobRunners };
}

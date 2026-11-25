import { registerMessagingImportJobRunner } from "./jobs/backgroundJobMessagingRunners.js";
import { registerMessagingCampaignJobRunner } from "./services/messagingCampaignJobRunner.js";

/** Registers the messaging background-job runners (called by the app composition root). */
export function createMessagingService(): { registerJobRunners: () => void } {
  return {
    registerJobRunners: () => {
      registerMessagingImportJobRunner();
      registerMessagingCampaignJobRunner();
    },
  };
}

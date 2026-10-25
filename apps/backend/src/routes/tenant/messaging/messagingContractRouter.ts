import type { FastifyPluginAsync } from "fastify";
import { messagingContract } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import {
  messagingListLogsHandler,
  messagingGetMetricsHandler,
  messagingRecordLogsHandler,
  messagingClearLogsHandler,
  messagingRestoreLogsHandler,
} from "./messagingLogContractHandlers.js";
import {
  messagingListTemplatesHandler,
  messagingSaveTemplateHandler,
  messagingDeleteTemplateHandler,
} from "./messagingTemplateContractHandlers.js";
import {
  messagingListRecipientsHandler,
  messagingMatchRecipientsHandler,
  messagingResolveContactsHandler,
} from "./messagingRecipientContractHandlers.js";
import {
  messagingGetPreferencesHandler,
  messagingUpdatePreferencesHandler,
} from "./messagingPreferencesContractHandlers.js";

const s = initServer();

export const messagingContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(messagingContract, {
    listLogs: messagingListLogsHandler,
    listTemplates: messagingListTemplatesHandler,
    listRecipients: messagingListRecipientsHandler,
    getMetrics: messagingGetMetricsHandler,
    saveTemplate: messagingSaveTemplateHandler,
    deleteTemplate: messagingDeleteTemplateHandler,
    recordLogs: messagingRecordLogsHandler,
    clearLogs: messagingClearLogsHandler,
    restoreLogs: messagingRestoreLogsHandler,
    resolveContacts: messagingResolveContactsHandler,
    matchRecipients: messagingMatchRecipientsHandler,
    getPreferences: messagingGetPreferencesHandler,
    updatePreferences: messagingUpdatePreferencesHandler,
  } as unknown as RouterImplementation<typeof messagingContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};

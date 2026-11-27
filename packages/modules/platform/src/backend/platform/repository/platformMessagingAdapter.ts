import {
  deletePlatformMessage,
  deletePlatformMessageTemplate,
  insertPlatformMessage,
  listPlatformMessageTemplates,
  listPlatformMessages,
  platformMessagingMetrics,
  restorePlatformMessage,
  savePlatformMessageTemplate,
} from "./db/platformMessagingRepository.js";
import { listPlatformContacts } from "../deps.js";
import { insertPlatformActivityLog } from "./db/platformActivityLogsRepository.js";

export interface PlatformMessagingRepository {
  listMessages(input: {
    channel?: string;
    status?: string;
    limit: number;
    offset: number;
    includeDeleted?: boolean;
  }): ReturnType<typeof listPlatformMessages>;
  send(
    input: Parameters<typeof insertPlatformMessage>[0],
  ): ReturnType<typeof insertPlatformMessage>;
  listContacts(
    input: Parameters<typeof listPlatformContacts>[0],
  ): ReturnType<typeof listPlatformContacts>;
  listTemplates(): ReturnType<typeof listPlatformMessageTemplates>;
  saveTemplate(
    id: string,
    input: Parameters<typeof savePlatformMessageTemplate>[1],
  ): ReturnType<typeof savePlatformMessageTemplate>;
  deleteTemplate(id: string): ReturnType<typeof deletePlatformMessageTemplate>;
  deleteMessage(id: string): ReturnType<typeof deletePlatformMessage>;
  restoreMessage(id: string): ReturnType<typeof restorePlatformMessage>;
  metrics(): ReturnType<typeof platformMessagingMetrics>;
  insertActivityLog(
    input: Parameters<typeof insertPlatformActivityLog>[0],
  ): ReturnType<typeof insertPlatformActivityLog>;
}

export const platformMessagingRepository: PlatformMessagingRepository = {
  listMessages: listPlatformMessages,
  send: insertPlatformMessage,
  listContacts: listPlatformContacts,
  listTemplates: listPlatformMessageTemplates,
  saveTemplate: savePlatformMessageTemplate,
  deleteTemplate: deletePlatformMessageTemplate,
  deleteMessage: deletePlatformMessage,
  restoreMessage: restorePlatformMessage,
  metrics: platformMessagingMetrics,
  insertActivityLog: insertPlatformActivityLog,
};

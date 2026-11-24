import {
  createPlatformContact,
  getPlatformContact,
  listPlatformContacts,
  platformContactsMetrics,
  restorePlatformContact,
  softDeletePlatformContact,
  updatePlatformContact,
} from "../../db/repositories/platformContactsRepository.js";
import { insertPlatformActivityLog } from "../../db/repositories/platformActivityLogsRepository.js";

export interface PlatformContactsRepository {
  list(input: {
    search?: string;
    kind?: string;
    limit: number;
    offset: number;
    includeDeleted?: boolean;
  }): ReturnType<typeof listPlatformContacts>;
  get(id: string): ReturnType<typeof getPlatformContact>;
  create(
    input: Parameters<typeof createPlatformContact>[0],
  ): ReturnType<typeof createPlatformContact>;
  update(
    id: string,
    input: Parameters<typeof updatePlatformContact>[1],
  ): ReturnType<typeof updatePlatformContact>;
  softDelete(id: string): ReturnType<typeof softDeletePlatformContact>;
  restore(id: string): ReturnType<typeof restorePlatformContact>;
  metrics(): ReturnType<typeof platformContactsMetrics>;
  insertActivityLog(
    input: Parameters<typeof insertPlatformActivityLog>[0],
  ): ReturnType<typeof insertPlatformActivityLog>;
}

export const platformContactsRepository: PlatformContactsRepository = {
  list: listPlatformContacts,
  get: getPlatformContact,
  create: createPlatformContact,
  update: updatePlatformContact,
  softDelete: softDeletePlatformContact,
  restore: restorePlatformContact,
  metrics: platformContactsMetrics,
  insertActivityLog: insertPlatformActivityLog,
};

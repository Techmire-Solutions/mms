import {
  createPlatformContact,
  getPlatformContact,
  listPlatformContacts,
  platformContactsMetrics,
  restorePlatformContact,
  softDeletePlatformContact,
  updatePlatformContact,
} from "./platformContactsRepository.js";
import { insertPlatformActivityLog } from "../deps.js";

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

function createPlatformContactsRepository(): PlatformContactsRepository {
  return {
    list: listPlatformContacts,
    get: getPlatformContact,
    create: createPlatformContact,
    update: updatePlatformContact,
    softDelete: softDeletePlatformContact,
    restore: restorePlatformContact,
    metrics: platformContactsMetrics,
    insertActivityLog: insertPlatformActivityLog,
  };
}

/** Active repository binding (production functions by default; overridable in tests). */
let activePlatformRepository: PlatformContactsRepository = createPlatformContactsRepository();

/** Delegates to the active repository so tests can inject a fake without touching routes. */
export const platformContactsRepository: PlatformContactsRepository = new Proxy(
  {} as PlatformContactsRepository,
  {
    get: (_target, property) =>
      (activePlatformRepository as unknown as Record<PropertyKey, unknown>)[property],
  },
);

/** Test-only: point the adapter at a fake repository. */
export function setPlatformContactsRepositoryForTesting(
  repository: PlatformContactsRepository,
): void {
  activePlatformRepository = repository;
}

/** Test-only: restore the production repository. */
export function resetPlatformContactsRepositoryForTesting(): void {
  activePlatformRepository = createPlatformContactsRepository();
}

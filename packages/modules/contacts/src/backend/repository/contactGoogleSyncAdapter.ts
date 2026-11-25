import {
  deleteContactGoogleSyncCredentials,
  findContactGoogleSyncCredentials,
  replaceContactGoogleSyncCredentialsForWorkspace,
  upsertContactGoogleSyncCredentials,
} from "./contactGoogleSyncRepository.js";

/**
 * Storage gateway for Google-contacts sync credentials.
 *
 * Same indirection as the other repository adapters: the use-case layer resolves
 * through this proxy so tests can inject a fake.
 */
export interface ContactGoogleSyncRepository {
  findCredentials(
    ...args: Parameters<typeof findContactGoogleSyncCredentials>
  ): ReturnType<typeof findContactGoogleSyncCredentials>;
  upsertCredentials(
    ...args: Parameters<typeof upsertContactGoogleSyncCredentials>
  ): ReturnType<typeof upsertContactGoogleSyncCredentials>;
  deleteCredentials(
    ...args: Parameters<typeof deleteContactGoogleSyncCredentials>
  ): ReturnType<typeof deleteContactGoogleSyncCredentials>;
  replaceCredentialsForWorkspace(
    ...args: Parameters<typeof replaceContactGoogleSyncCredentialsForWorkspace>
  ): ReturnType<typeof replaceContactGoogleSyncCredentialsForWorkspace>;
}

function createContactGoogleSyncRepository(): ContactGoogleSyncRepository {
  return {
    findCredentials: findContactGoogleSyncCredentials,
    upsertCredentials: upsertContactGoogleSyncCredentials,
    deleteCredentials: deleteContactGoogleSyncCredentials,
    replaceCredentialsForWorkspace: replaceContactGoogleSyncCredentialsForWorkspace,
  };
}

let activeRepository: ContactGoogleSyncRepository = createContactGoogleSyncRepository();

/** Delegates to the active repository; production uses the Drizzle-backed functions. */
export const contactGoogleSyncRepository: ContactGoogleSyncRepository = new Proxy(
  {} as ContactGoogleSyncRepository,
  {
    get: (_target, property) =>
      (activeRepository as unknown as Record<PropertyKey, unknown>)[property],
  },
);

/** Test-only: point the adapter at a fake repository. */
export function setContactGoogleSyncRepositoryForTesting(
  repository: ContactGoogleSyncRepository,
): void {
  activeRepository = repository;
}

/** Test-only: restore the Drizzle-backed repository. */
export function resetContactGoogleSyncRepositoryForTesting(): void {
  activeRepository = createContactGoogleSyncRepository();
}

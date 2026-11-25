import type { ContactLookupKind } from "@mms/contracts";
import {
  listAllContactLookupsByWorkspace,
  listContactLookupsByKind,
  listContactLookupsByWorkspace,
  replaceContactLookupsForKind,
  replaceContactLookupsForWorkspace,
  type LookupDbRow,
} from "./contactLookupsRepository.js";

/**
 * Storage gateway for the contact string lookups.
 *
 * The use-case layer resolves the lookups through this indirection so tests can
 * swap the storage functions without rewriting the module-internal imports.
 */
export interface ContactLookupsRepository {
  listByWorkspace(workspaceSubdomain: string): Promise<LookupDbRow[]>;
  listByKind(workspaceSubdomain: string, kind: ContactLookupKind): Promise<LookupDbRow[]>;
  replaceForKind(
    workspaceSubdomain: string,
    kind: ContactLookupKind,
    rows: Parameters<typeof replaceContactLookupsForKind>[2],
  ): ReturnType<typeof replaceContactLookupsForKind>;
  listAllByWorkspace(
    workspaceSubdomain: string,
  ): ReturnType<typeof listAllContactLookupsByWorkspace>;
  replaceForWorkspace(
    workspaceSubdomain: string,
    rows: Parameters<typeof replaceContactLookupsForWorkspace>[1],
  ): ReturnType<typeof replaceContactLookupsForWorkspace>;
}

function createContactLookupsRepository(): ContactLookupsRepository {
  return {
    listByWorkspace: listContactLookupsByWorkspace,
    listByKind: listContactLookupsByKind,
    replaceForKind: replaceContactLookupsForKind,
    listAllByWorkspace: listAllContactLookupsByWorkspace,
    replaceForWorkspace: replaceContactLookupsForWorkspace,
  };
}

let activeRepository: ContactLookupsRepository = createContactLookupsRepository();

/** Delegates to the active repository; production uses the Drizzle-backed functions. */
export const contactLookupsRepository: ContactLookupsRepository = new Proxy(
  {} as ContactLookupsRepository,
  {
    get: (_target, property) =>
      (activeRepository as unknown as Record<PropertyKey, unknown>)[property],
  },
);

/** Test-only: point the adapter at a fake repository. */
export function setContactLookupsRepositoryForTesting(repository: ContactLookupsRepository): void {
  activeRepository = repository;
}

/** Test-only: restore the Drizzle-backed repository. */
export function resetContactLookupsRepositoryForTesting(): void {
  activeRepository = createContactLookupsRepository();
}

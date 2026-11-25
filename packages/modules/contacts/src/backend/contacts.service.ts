import type { Contact } from "@mms/contracts";
import { loadContactFieldConfig } from "./use-cases/contactConfigService.js";
import { loadContactsByIds } from "./use-cases/contactUseCases.js";
import { reconcileContactSystemTags } from "./systemTags/contactSystemTagUseCases.js";
import { upsertContact } from "./use-cases/contactWriteUseCases.js";
import type { ContactsPorts } from "./ports.js";

/**
 * Core contacts orchestration surface. Wraps the use-case layer so the app
 * composition root (and the inbound `ContactsPorts`) has one stable entry point.
 */
export function createContactsService(): ContactsPorts {
  return {
    write: {
      upsertContact: (contact: Contact, options?: any) => upsertContact(contact, options),
    },
    config: {
      loadContactFieldConfig: () => loadContactFieldConfig() as Promise<any>,
    },
    systemTags: {
      reconcileContactSystemTags: (tenant: string, contactIds: string[], options?: any) =>
        reconcileContactSystemTags(tenant, contactIds, options),
    },
    load: {
      loadContactsByIds: (ids: string[]) => loadContactsByIds(ids) as Promise<Contact[]>,
    },
  };
}

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
      upsertContact: (contact, options) => upsertContact(contact, options),
    },
    config: {
      loadContactFieldConfig: async () => loadContactFieldConfig(),
    },
    systemTags: {
      reconcileContactSystemTags: (tenant, contactIds, options) =>
        reconcileContactSystemTags(tenant, contactIds, options),
    },
    load: {
      loadContactsByIds: (ids) => loadContactsByIds(ids) as Promise<Contact[]>,
    },
  };
}

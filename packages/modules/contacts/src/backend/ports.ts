import type { Contact, FieldConfig, User } from "@mms/contracts";
import type { UpsertContactOptions } from "./use-cases/contactWriteOptions.js";

/**
 * Inbound contract for the contacts module.
 *
 * Other domains (students, faculty, enrollments, finance, messaging) and kernel
 * services consume contacts through this port instead of importing the module's
 * use-cases directly, so those domains can later become modules without a
 * module→module edge (blueprint D3). The app composition root binds it in
 * `apps/api/src/modules/contacts/adapters.ts`.
 */
export interface ContactsPorts {
  write: {
    upsertContact(
      contact: Contact,
      options?: User | UpsertContactOptions,
    ): Promise<{ contact: Contact; created: boolean; restoredFromDelete?: boolean }>;
  };
  config: {
    loadContactFieldConfig(): Promise<FieldConfig | null>;
  };
  systemTags: {
    reconcileContactSystemTags(
      tenant: string,
      contactIds: Array<string | number | null | undefined>,
      options?: { actorId?: string },
    ): Promise<number>;
  };
  load: {
    loadContactsByIds(ids: string[]): Promise<Contact[]>;
  };
}

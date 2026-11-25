import type { Contact, FieldConfig } from "@mms/contracts";

/**
 * Inbound contract for the contacts module.
 *
 * Other domains (students, faculty, enrollments, finance, messaging) and kernel
 * services consume contacts through this port instead of importing the module's
 * use-cases directly, so those domains can later become modules without a
 * module→module edge (blueprint D3). The app composition root binds it in
 * `apps/backend/src/modules/contacts/adapters.ts`.
 */
export interface ContactsPorts {
  write: {
    upsertContact(contact: Contact, options?: any): Promise<any>;
  };
  config: {
    loadContactFieldConfig(): Promise<FieldConfig | null>;
  };
  systemTags: {
    reconcileContactSystemTags(tenant: string, contactIds: string[], options?: any): Promise<any>;
  };
  load: {
    loadContactsByIds(ids: string[]): Promise<Contact[]>;
  };
}

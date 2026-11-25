import { initContract } from "@ts-rest/core";
import { contactsCrudRoutes } from "./contactsCrud.contract.js";
import { contactsReportsRoutes } from "./contactsReports.contract.js";
import { contactsSetupRoutes } from "./contactsSetup.contract.js";
import { contactsGoogleSyncRoutes } from "./contactsGoogleSync.contract.js";
import { contactsPickerRoutes } from "./contactsPicker.contract.js";

export * from "./contacts.contract.schemas.js";

export { contactsCrudRoutes, contactsReportsRoutes, contactsSetupRoutes, contactsGoogleSyncRoutes };
export { contactsPickerRoutes };

const c = initContract();

/** Nested so the routes keep their `search` / `get` names without shadowing CRUD `get`. */
export const contactsPickerContract = c.router(contactsPickerRoutes);

export const contactsCrudContract = c.router(contactsCrudRoutes);
export const contactsReportsContract = c.router(contactsReportsRoutes);
export const contactsSetupContract = c.router(contactsSetupRoutes);
export const contactsGoogleSyncContract = c.router(contactsGoogleSyncRoutes);

export const contactsContract = c.router({
  ...contactsCrudRoutes,
  ...contactsReportsRoutes,
  ...contactsSetupRoutes,
  ...contactsGoogleSyncRoutes,
  picker: contactsPickerContract,
});

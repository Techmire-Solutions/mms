import { initContract } from "@ts-rest/core";
import { contactsCrudRoutes } from "./contactsCrud.contract.js";
import { contactsReportsRoutes } from "./contactsReports.contract.js";
import { contactsSetupRoutes } from "./contactsSetup.contract.js";
import { contactsGoogleSyncRoutes } from "./contactsGoogleSync.contract.js";

export * from "./contacts.contract.schemas.js";

export {
  contactsCrudRoutes,
  contactsReportsRoutes,
  contactsSetupRoutes,
  contactsGoogleSyncRoutes,
};

const c = initContract();

export const contactsContract = c.router({
  ...contactsCrudRoutes,
  ...contactsReportsRoutes,
  ...contactsSetupRoutes,
  ...contactsGoogleSyncRoutes,
});

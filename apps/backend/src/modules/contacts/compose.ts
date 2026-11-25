import { createContactsService } from "@mms/mod-contacts/backend/service";
import { configureContactsKernelAdapters } from "./adapters.js";

configureContactsKernelAdapters();

/** Contacts orchestration surface for inbound `ContactsPorts` consumers. */
export const contactsService = createContactsService();

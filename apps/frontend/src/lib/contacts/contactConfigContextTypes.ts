import { createContext } from "react";
import type { ContactConfigExtras } from "./useContactConfigTypes";
import { getDefaultContactConfigContextValue } from "./defaultContactConfigValue";

/** Column descriptor for Contacts tables and grid views. */
export interface ContactsColumnConfig {
  id: string;
  label: string;
  sortField?: string;
  width?: number;
}

/** Complete Contact Configuration Context shape consumed by tenant views and forms. */
export interface ContactConfigContextType extends Omit<
  ContactConfigExtras,
  "lookupsReady" | "reloadCollections"
> {
  defaultPhoneCountryCode: string;
}

/** React Context instance for Contacts module configuration. */
export const ContactConfigContext = createContext<ContactConfigContextType>(
  getDefaultContactConfigContextValue(),
);

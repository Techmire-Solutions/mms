import { getStudentsHost } from "../host.js";

export const invalidateContactsQueries: any = (...args: any[]) =>
  (getStudentsHost() as any).contactsCollection?.invalidateContactsQueries?.(...args);

function hostFn(name: string) {
  return (...args: any[]) => (getStudentsHost() as any).contactsCollection?.[name]?.(...args);
}

export const useContactsByIds: any = (...args: any[]) => hostFn("useContactsByIds")(...args);
export const useContactById: any = (...args: any[]) => hostFn("useContactById")(...args);
export const useContactMutations: any = (...args: any[]) => hostFn("useContactMutations")(...args);

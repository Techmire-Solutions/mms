import {
  SESSION_LOOKUP_KINDS,
  defaultSessionLookupItems,
  emptySessionLookupsMap,
  type SessionLookupKind,
  type SessionLookupsMap,
} from "@mms/contracts";
import { createModuleStringListLookupsService } from "@mms/be-core/data/module-string-lookups";
import {
  listSessionLookupsByKind,
  listSessionLookupsByWorkspace,
  replaceSessionLookupsForKind,
} from "../repository/db/sessionLookupsRepository.js";

const stringListLookups = createModuleStringListLookupsService<
  SessionLookupKind,
  SessionLookupsMap
>({
  kinds: SESSION_LOOKUP_KINDS,
  emptyMap: () => emptySessionLookupsMap,
  defaultItems: (kind) => defaultSessionLookupItems[kind],
  listByWorkspace: listSessionLookupsByWorkspace,
  listByKind: listSessionLookupsByKind,
  replaceForKind: replaceSessionLookupsForKind,
  broadcastKey: "sessions",
});

export const loadSessionLookupsMap = stringListLookups.loadMap;
export const replaceSessionLookupKind = stringListLookups.replaceKind;

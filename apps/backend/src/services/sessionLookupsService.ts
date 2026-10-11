import {
  SESSION_LOOKUP_KINDS,
  defaultSessionLookupItems,
  emptySessionLookupsMap,
  type SessionLookupKind,
  type SessionLookupsMap,
} from "@mms/shared";
import { createModuleStringListLookupsService } from "../lib/createModuleStringListLookupsService.js";
import {
  listSessionLookupsByKind,
  listSessionLookupsByWorkspace,
  replaceSessionLookupsForKind,
} from "../db/repositories/sessionLookupsRepository.js";

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

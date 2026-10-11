import {
  FACULTY_LOOKUP_KINDS,
  defaultFacultyLookupItems,
  emptyFacultyLookupsMap,
  type FacultyLookupKind,
  type FacultyLookupsMap,
} from "@mms/shared";
import { createModuleStringListLookupsService } from "../../lib/createModuleStringListLookupsService.js";
import {
  listFacultyLookupsByKind,
  listFacultyLookupsByWorkspace,
  replaceFacultyLookupsForKind,
} from "../../db/repositories/facultyLookupsRepository.js";

const stringListLookups = createModuleStringListLookupsService<
  FacultyLookupKind,
  FacultyLookupsMap
>({
  kinds: FACULTY_LOOKUP_KINDS,
  emptyMap: emptyFacultyLookupsMap,
  defaultItems: defaultFacultyLookupItems,
  listByWorkspace: listFacultyLookupsByWorkspace,
  listByKind: listFacultyLookupsByKind,
  replaceForKind: replaceFacultyLookupsForKind,
  broadcastKey: "faculty",
});

export const loadFacultyLookupsMap = stringListLookups.loadMap;

export const replaceFacultyLookupKind = stringListLookups.replaceKind;

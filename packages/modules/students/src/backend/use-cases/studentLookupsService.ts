import {
  STUDENT_LOOKUP_KINDS,
  defaultStudentLookupItems,
  emptyStudentLookupsMap,
  type StudentLookupKind,
  type StudentLookupsMap,
} from "@mms/contracts";
import { createModuleStringListLookupsService } from "@mms/be-core/data/module-string-lookups";
import {
  listStudentLookupsByKind,
  listStudentLookupsByWorkspace,
  replaceStudentLookupsForKind,
} from "../repository/db/studentLookupsRepository.js";

const stringListLookups = createModuleStringListLookupsService<
  StudentLookupKind,
  StudentLookupsMap
>({
  kinds: STUDENT_LOOKUP_KINDS,
  emptyMap: emptyStudentLookupsMap,
  defaultItems: defaultStudentLookupItems,
  listByWorkspace: listStudentLookupsByWorkspace,
  listByKind: listStudentLookupsByKind,
  replaceForKind: replaceStudentLookupsForKind,
  broadcastKey: "students",
});

export const loadStudentLookupsMap = stringListLookups.loadMap;
export const loadStudentLookupKind = stringListLookups.loadKind;
export const replaceStudentLookupKind = stringListLookups.replaceKind;

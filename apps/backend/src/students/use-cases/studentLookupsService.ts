import {
  STUDENT_LOOKUP_KINDS,
  defaultStudentLookupItems,
  emptyStudentLookupsMap,
  type StudentLookupKind,
  type StudentLookupsMap,
} from "@mms/shared";
import { createModuleStringListLookupsService } from "../../lib/createModuleStringListLookupsService.js";
import {
  listStudentLookupsByKind,
  listStudentLookupsByWorkspace,
  replaceStudentLookupsForKind,
} from "../../db/repositories/studentLookupsRepository.js";

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

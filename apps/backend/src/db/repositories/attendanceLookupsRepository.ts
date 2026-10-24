import type { AttendanceLookupKind } from "@mms/shared";
import { attendanceLookups } from "../schema.js";
import {
  createModuleLookupsRepo,
  type ModuleLookupRowInput,
  type ModuleLookupDbRow,
} from "./moduleSetupRepoFactories.js";

export type { ModuleLookupDbRow as LookupDbRow };

export interface AttendanceLookupRowInput extends Omit<ModuleLookupRowInput, "kind"> {
  kind: AttendanceLookupKind;
}

const repo = createModuleLookupsRepo({ table: attendanceLookups });

export const listAttendanceLookupsByWorkspace = (ws: string): Promise<ModuleLookupDbRow[]> =>
  repo.listByWorkspace(ws);
export const listAttendanceLookupsByKind = (
  workspaceSubdomain: string,
  kind: AttendanceLookupKind,
): Promise<ModuleLookupDbRow[]> => repo.listByKind(workspaceSubdomain, kind);
export const replaceAttendanceLookupsForKind = (
  workspaceSubdomain: string,
  kind: AttendanceLookupKind,
  rows: AttendanceLookupRowInput[],
) => repo.replaceForKind(workspaceSubdomain, kind, rows);
/** Full-workspace list for admin backup snapshots. */
export const listAllAttendanceLookupsByWorkspace = repo.listAllByWorkspace;
/** Admin restore wipe+replace for the whole workspace. */
export const replaceAttendanceLookupsForWorkspace = repo.replaceForWorkspace;

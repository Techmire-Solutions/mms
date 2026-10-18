import type { FacultyLookupKind } from "@mms/shared";
import { facultyLookups } from "../schema.js";
import {
  createModuleLookupsRepo,
  type ModuleLookupRowInput,
  type ModuleLookupDbRow,
} from "./moduleSetupRepoFactories.js";

export type { ModuleLookupDbRow as LookupDbRow };

export interface FacultyLookupRowInput extends Omit<ModuleLookupRowInput, "kind"> {
  kind: FacultyLookupKind;
}

const repo = createModuleLookupsRepo({ table: facultyLookups });

export const listFacultyLookupsByWorkspace = (ws: string): Promise<ModuleLookupDbRow[]> =>
  repo.listByWorkspace(ws);
export const listFacultyLookupsByKind = (
  workspaceSubdomain: string,
  kind: FacultyLookupKind,
): Promise<ModuleLookupDbRow[]> => repo.listByKind(workspaceSubdomain, kind);
export const replaceFacultyLookupsForKind = (
  workspaceSubdomain: string,
  kind: FacultyLookupKind,
  rows: FacultyLookupRowInput[],
) => repo.replaceForKind(workspaceSubdomain, kind, rows);
/** Full-workspace list for admin backup snapshots. */
export const listAllFacultyLookupsByWorkspace = repo.listAllByWorkspace;
/** Admin restore wipe+replace for the whole workspace. */
export const replaceFacultyLookupsForWorkspace = repo.replaceForWorkspace;

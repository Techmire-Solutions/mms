import type { StudentLookupKind } from "@mms/shared";
import { studentLookups } from "../schema.js";
import {
  createModuleLookupsRepo,
  type ModuleLookupRowInput,
  type ModuleLookupDbRow,
} from "./moduleSetupRepoFactories.js";

export type { ModuleLookupDbRow as LookupDbRow };

interface StudentLookupRowInput extends Omit<ModuleLookupRowInput, "kind"> {
  kind: StudentLookupKind;
}

const repo = createModuleLookupsRepo({ table: studentLookups });

export const listStudentLookupsByWorkspace = (ws: string): Promise<ModuleLookupDbRow[]> =>
  repo.listByWorkspace(ws);
export const listStudentLookupsByKind = (
  workspaceSubdomain: string,
  kind: StudentLookupKind,
): Promise<ModuleLookupDbRow[]> => repo.listByKind(workspaceSubdomain, kind);
export const replaceStudentLookupsForKind = (
  workspaceSubdomain: string,
  kind: StudentLookupKind,
  rows: StudentLookupRowInput[],
) => repo.replaceForKind(workspaceSubdomain, kind, rows);
/** Full-workspace list for admin backup snapshots. */
export const listAllStudentLookupsByWorkspace = repo.listAllByWorkspace;
/** Admin restore wipe+replace for the whole workspace. */
export const replaceStudentLookupsForWorkspace = repo.replaceForWorkspace;

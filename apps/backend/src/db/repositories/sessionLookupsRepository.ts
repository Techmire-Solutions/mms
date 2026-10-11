import type { SessionLookupKind } from "@mms/shared";
import { sessionLookups } from "../schema.js";
import {
  createModuleLookupsRepo,
  type ModuleLookupRowInput,
  type ModuleLookupDbRow,
} from "./moduleSetupRepoFactories.js";

export type { ModuleLookupDbRow as LookupDbRow };

export interface SessionLookupRowInput extends Omit<ModuleLookupRowInput, "kind"> {
  kind: SessionLookupKind;
}

const repo = createModuleLookupsRepo({ table: sessionLookups });

export const listSessionLookupsByWorkspace = (ws: string): Promise<ModuleLookupDbRow[]> =>
  repo.listByWorkspace(ws);
export const listSessionLookupsByKind = (
  workspaceSubdomain: string,
  kind: SessionLookupKind,
): Promise<ModuleLookupDbRow[]> => repo.listByKind(workspaceSubdomain, kind);
export const replaceSessionLookupsForKind = (
  workspaceSubdomain: string,
  kind: SessionLookupKind,
  rows: SessionLookupRowInput[],
) => repo.replaceForKind(workspaceSubdomain, kind, rows);
/** Full-workspace list for admin backup snapshots. */
export const listAllSessionLookupsByWorkspace = repo.listAllByWorkspace;
/** Admin restore wipe+replace for the whole workspace. */
export const replaceSessionLookupsForWorkspace = repo.replaceForWorkspace;

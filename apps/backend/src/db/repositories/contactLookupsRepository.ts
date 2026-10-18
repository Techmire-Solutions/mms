import type { ContactLookupKind } from "@mms/shared";
import { contactLookups } from "../schema.js";
import {
  createModuleLookupsRepo,
  type ModuleLookupRowInput,
  type ModuleLookupDbRow,
} from "./moduleSetupRepoFactories.js";

export type { ModuleLookupDbRow as LookupDbRow };

interface ContactLookupRowInput extends Omit<ModuleLookupRowInput, "kind"> {
  kind: ContactLookupKind;
}

const repo = createModuleLookupsRepo({ table: contactLookups });

export const listContactLookupsByWorkspace = (ws: string): Promise<ModuleLookupDbRow[]> =>
  repo.listByWorkspace(ws);
export const listContactLookupsByKind = (
  workspaceSubdomain: string,
  kind: ContactLookupKind,
): Promise<ModuleLookupDbRow[]> => repo.listByKind(workspaceSubdomain, kind);
export const replaceContactLookupsForKind = (
  workspaceSubdomain: string,
  kind: ContactLookupKind,
  rows: ContactLookupRowInput[],
) => repo.replaceForKind(workspaceSubdomain, kind, rows);
/** Full-workspace list for admin backup snapshots. */
export const listAllContactLookupsByWorkspace = repo.listAllByWorkspace;
/** Admin restore wipe+replace for the whole workspace. */
export const replaceContactLookupsForWorkspace = repo.replaceForWorkspace;

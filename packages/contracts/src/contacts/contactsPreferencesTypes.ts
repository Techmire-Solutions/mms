import type { ModuleColumnPreference } from "../settings/moduleColumnCore.js";

/** Report segment → Work directory drill-down (globle1 §4.3). */
export interface ContactsWorkDrillDown {
  gender?: string;
  search?: string;
  /** Work quick-filter preset id (e.g. whatsapp, missingInfo). */
  quickFilter?: string;
}

/** Alias of ModuleColumnPreference — Contacts Work column prefs share the module SSOT. */
export type ContactColumnPreference = ModuleColumnPreference;

export interface ContactsSavedReport {
  id: string;
  name: string;
  drillDown: ContactsWorkDrillDown;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  lastRunAt?: string;
  /** Defaults to private when omitted (legacy presets). */
  shareScope?: "private" | "roles" | "users" | "global";
  sharedWithRoles?: string[];
  sharedWithUserIds?: string[];
}

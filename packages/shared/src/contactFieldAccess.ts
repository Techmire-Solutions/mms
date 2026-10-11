import type { FieldDefinition, TabDefinition } from "./contactTypes.js";

/** Field-level visibility by viewer role (Setup stores role strings on `permissions[]`). */
export function canViewContactField(viewerRole: string, field: FieldDefinition): boolean {
  if (!field.permissions?.length) return true;
  return field.permissions.includes(viewerRole);
}

/** Tab visibility by registry `permissions[]` (empty = all roles). */
export function canViewContactTab(viewerRole: string, tab: TabDefinition): boolean {
  if (!tab.enabled) return false;
  if (!tab.permissions?.length) return true;
  return tab.permissions.includes(viewerRole);
}

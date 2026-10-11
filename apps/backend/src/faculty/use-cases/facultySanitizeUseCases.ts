import {
  sanitizeFacultyForViewer as sanitizeFacultyRecord,
  sanitizeFacultyListForViewer as sanitizeFacultyRecords,
  type FieldDefinition,
  type Faculty,
  type FacultySettings,
} from "@mms/shared";
import { loadFacultyFieldConfig } from "./facultyConfigService.js";

function settingsSnapshot(settings: FacultySettings | null) {
  if (!settings) return null;
  const fields =
    settings.fields && typeof settings.fields === "object" && !Array.isArray(settings.fields)
      ? (settings.fields as Record<string, FieldDefinition[]>)
      : undefined;
  if (!fields) return null;
  return {
    fields,
    tabs: settings.formTabs ?? [],
  };
}

/** Strips faculty properties the viewer role cannot read (field-config + viewer role). */
export async function sanitizeFacultyForViewer(
  member: Faculty,
  viewerRole: string,
): Promise<Faculty> {
  const config = settingsSnapshot(await loadFacultyFieldConfig());
  if (!config) return member;
  return sanitizeFacultyRecord(member, viewerRole, config);
}

export async function sanitizeFacultyListForViewer(
  members: Faculty[],
  viewerRole: string,
): Promise<Faculty[]> {
  const config = settingsSnapshot(await loadFacultyFieldConfig());
  if (!config) return members;
  return sanitizeFacultyRecords(members, viewerRole, config);
}

import {
  WORKSPACES_COLLECTION,
  splitStudentsSettingsBlob,
  DEFAULT_STUDENTS_SETTINGS,
  splitFacultySettingsBlob,
  DEFAULT_FACULTY_SETTINGS,
} from "@mms/shared";
import { getMinimalCollectionsForSeed, getMinimalObjects } from "../db/minimalSeeds.js";
import { getCollection, getObject, saveCollection, saveObject } from "../db/database.js";
import { getRequestTenant } from "../lib/tenantContext.js";
import { upsertStudentFieldConfig } from "../db/repositories/studentFieldConfigRepository.js";
import { upsertStudentModulePreferences } from "../db/repositories/studentModulePreferencesRepository.js";
import { upsertFacultyFieldConfig } from "../db/repositories/facultyFieldConfigRepository.js";
import { upsertFacultyModulePreferences } from "../db/repositories/facultyModulePreferencesRepository.js";

/**
 * Seeds default collections and objects for a new tenant workspace.
 * Caller must bind tenant context via `runWithTenant` first.
 */
export async function seedTenantDefaults(): Promise<void> {
  const collections = await getMinimalCollectionsForSeed();
  const subdomain = getRequestTenant();

  for (const [name, rawData] of Object.entries(collections)) {
    if (name === WORKSPACES_COLLECTION) continue;
    const existing = await getCollection(name);
    if (Array.isArray(existing) && existing.length > 0) continue;

    await saveCollection(name, rawData as unknown[]);
  }

  const objects = getMinimalObjects();
  for (const [key, objectSeed] of Object.entries(objects)) {
    if (key === "branding" || key === "global_settings") continue;
    const existing = await getObject(key);
    if (existing !== null && existing !== undefined) continue;
    await saveObject(key, objectSeed);
  }

  if (subdomain) {
    const { fieldConfig, preferences } = splitStudentsSettingsBlob(DEFAULT_STUDENTS_SETTINGS);
    await upsertStudentFieldConfig(subdomain, fieldConfig);
    await upsertStudentModulePreferences(subdomain, Object.assign({}, preferences));

    const facultySetup = splitFacultySettingsBlob(DEFAULT_FACULTY_SETTINGS);
    await upsertFacultyFieldConfig(subdomain, facultySetup.fieldConfig);
    await upsertFacultyModulePreferences(subdomain, Object.assign({}, facultySetup.preferences));
  }
}

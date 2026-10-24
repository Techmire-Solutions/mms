import {
  DEFAULT_QUESTION_BANK_RESULTS,
  DEFAULT_QUESTION_BANK_SETTINGS,
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
} from "@mms/shared";
import {
  getCollectionByStorageName,
  getObjectByStorageKey,
  listCollectionStorageNames,
  saveCollection,
  saveObject,
} from "../database.js";

async function discoverTenantSubdomains(): Promise<Set<string>> {
  const subdomains = new Set<string>();
  const names = await listCollectionStorageNames();
  for (const name of names) {
    const parsed = parseTenantScopedStorageKey(name);
    if (parsed) subdomains.add(parsed.subdomain);
  }
  const workspaces = await getCollectionByStorageName(WORKSPACES_COLLECTION);
  if (Array.isArray(workspaces)) {
    for (const entry of workspaces) {
      const subdomain = (entry as Workspace).subdomain;
      if (subdomain) subdomains.add(subdomain);
    }
  }
  return subdomains;
}

async function seedQuestionBankForPrefix(prefix: string): Promise<boolean> {
  let changed = false;

  const questionsKey = prefix ? `${prefix}questions` : "questions";
  const existingQuestions = await getCollectionByStorageName(questionsKey);
  if (!Array.isArray(existingQuestions) || existingQuestions.length === 0) {
    await saveCollection(questionsKey, []);
    changed = true;
  }

  const testsKey = prefix ? `${prefix}tests` : "tests";
  const existingTests = await getCollectionByStorageName(testsKey);
  if (!Array.isArray(existingTests) || existingTests.length === 0) {
    await saveCollection(testsKey, []);
    changed = true;
  }

  const resultsKey = prefix ? `${prefix}assessment_results` : "assessment_results";
  const existingResults = await getCollectionByStorageName(resultsKey);
  if (!Array.isArray(existingResults) || existingResults.length === 0) {
    await saveCollection(resultsKey, DEFAULT_QUESTION_BANK_RESULTS);
    changed = true;
  }

  const settingsKey = prefix ? `${prefix}question_bank_settings` : "question_bank_settings";
  const existingSettings = await getObjectByStorageKey(settingsKey);
  if (existingSettings === null) {
    await saveObject(settingsKey, DEFAULT_QUESTION_BANK_SETTINGS);
    changed = true;
  }

  return changed;
}

/**
 * Seeds default question bank data (questions, tests, results, settings) for all subdomains.
 */
export async function runMigration019(): Promise<void> {
  const subdomains = await discoverTenantSubdomains();
  let changed = false;

  if (subdomains.size === 0) {
    changed = await seedQuestionBankForPrefix("");
  } else {
    for (const subdomain of subdomains) {
      const didChange = await seedQuestionBankForPrefix(tenantCollectionKey(subdomain, ""));
      changed = changed || didChange;
    }
  }

  if (changed) {
    console.log(
      "[Migration 019] Seeded database-owned question bank default collections and settings.",
    );
  }
}

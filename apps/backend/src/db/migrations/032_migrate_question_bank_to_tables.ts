import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
  type QuestionBankQuestion,
  type QuestionBankTest,
  type QuestionBankResult,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import {
  replaceQuestionsForWorkspace,
  replaceTestsForWorkspace,
  replaceResultsForWorkspace,
} from "../repositories/questionBankRepository.js";

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

export async function runMigration032(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();

  for (const subdomain of subdomains) {
    const prefix = tenantCollectionKey(subdomain, "");

    // 1. Questions
    const legacyQuestions = await getCollectionByStorageName(`${prefix}questions`);
    if (Array.isArray(legacyQuestions) && legacyQuestions.length > 0) {
      await replaceQuestionsForWorkspace(subdomain, legacyQuestions as QuestionBankQuestion[]);
      changed = true;
      console.log(
        `[Migration 032] Imported ${legacyQuestions.length} question(s) for "${subdomain}" into questions table.`,
      );
    }

    // 2. Tests
    const legacyTests = await getCollectionByStorageName(`${prefix}tests`);
    if (Array.isArray(legacyTests) && legacyTests.length > 0) {
      await replaceTestsForWorkspace(subdomain, legacyTests as QuestionBankTest[]);
      changed = true;
      console.log(
        `[Migration 032] Imported ${legacyTests.length} test(s) for "${subdomain}" into tests table.`,
      );
    }

    // 3. Assessment Results
    const legacyResults = await getCollectionByStorageName(`${prefix}assessment_results`);
    if (Array.isArray(legacyResults) && legacyResults.length > 0) {
      await replaceResultsForWorkspace(subdomain, legacyResults as QuestionBankResult[]);
      changed = true;
      console.log(
        `[Migration 032] Imported ${legacyResults.length} assessment result(s) for "${subdomain}" into assessment_results table.`,
      );
    }
  }

  if (!changed) {
    console.log("[Migration 032] No legacy question bank records to import.");
  }
}

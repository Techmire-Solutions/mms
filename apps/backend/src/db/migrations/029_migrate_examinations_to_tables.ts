import {
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type Workspace,
  type Exam,
  type ExamResult,
} from "@mms/shared";
import { getCollectionByStorageName, listCollectionStorageNames } from "../database.js";
import {
  replaceExamsForWorkspace,
  replaceExamResultsForWorkspace,
} from "../repositories/examinationRepository.js";

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

export async function runMigration029(): Promise<void> {
  let changed = false;
  const subdomains = await discoverTenantSubdomains();

  for (const subdomain of subdomains) {
    const prefix = tenantCollectionKey(subdomain, "");

    // 1. Exams
    const legacyExams = await getCollectionByStorageName(`${prefix}exams`);
    if (Array.isArray(legacyExams) && legacyExams.length > 0) {
      await replaceExamsForWorkspace(subdomain, legacyExams as Exam[]);
      changed = true;
      console.log(
        `[Migration 029] Imported ${legacyExams.length} exam(s) for "${subdomain}" into exams table.`,
      );
    }

    // 2. Exam Results
    const legacyResults = await getCollectionByStorageName(`${prefix}exam_results`);
    if (Array.isArray(legacyResults) && legacyResults.length > 0) {
      await replaceExamResultsForWorkspace(subdomain, legacyResults as ExamResult[]);
      changed = true;
      console.log(
        `[Migration 029] Imported ${legacyResults.length} exam result(s) for "${subdomain}" into exam_results table.`,
      );
    }
  }

  if (!changed) {
    console.log("[Migration 029] No legacy examination records to import.");
  }
}

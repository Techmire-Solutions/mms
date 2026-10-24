import type { ContactLike } from "@mms/shared";
import { hydrateCollectionRows, normalizeCollectionRows } from "@/lib/contactLink/collectionSync";
import { scopedStorageKey } from "@/lib/dbStorageCore";

export const LINK_MANAGED_COLLECTIONS = new Set([
  "students",
  "faculty",
  "enrollments",
  "attendance_records",
  "finance_invoices",
  "finance_payments",
  "sessions",
  "users",
  "user_activity_logs",
  "hasanat_distributions",
  "hasanat_redemptions",
  "assessment_results",
  "exam_results",
  "hasanat_payouts",
  "hasanat_batches",
]);

type CollectionRow = Record<string, unknown>;

export function readRawCollection<T = CollectionRow>(key: string): T[] {
  try {
    const saved = localStorage.getItem(scopedStorageKey(key));
    if (saved === null || saved === "undefined") return [];
    const parsed = JSON.parse(saved) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function getLinkHydrationContext() {
  const contacts = readRawCollection<ContactLike>("contacts");
  const rawStudents = readRawCollection("students");
  const rawFaculty = readRawCollection("faculty");
  const base = {
    contacts,
    students: [] as CollectionRow[],
    faculty: [] as CollectionRow[],
    users: [] as CollectionRow[],
    distributions: [] as CollectionRow[],
  };
  const students = hydrateCollectionRows("students", rawStudents, base);
  const faculty = hydrateCollectionRows("faculty", rawFaculty, base);
  const users = hydrateCollectionRows("users", readRawCollection("users"), {
    ...base,
    students,
    faculty,
  });
  return {
    contacts,
    students,
    faculty,
    users,
    distributions: readRawCollection("hasanat_distributions"),
  };
}

export function hydrateLinkedCollection<T>(key: string, rows: T[]): T[] {
  if (!LINK_MANAGED_COLLECTIONS.has(key)) return rows;
  return hydrateCollectionRows(key, rows as CollectionRow[], getLinkHydrationContext()) as T[];
}

export function normalizeLinkedCollection<T>(key: string, rows: T[]): T[] {
  if (!LINK_MANAGED_COLLECTIONS.has(key)) return rows;
  return normalizeCollectionRows(key, rows as CollectionRow[]) as T[];
}

/** Active workspace localStorage key prefix (`mms_` on apex, `mms_t:{slug}:` on tenant). */

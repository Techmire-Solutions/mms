import {
  normalizeActivityLog,
  normalizeAssessmentResult,
  normalizeHasanatDistribution,
  normalizeHasanatRedemption,
  normalizeSessionsCollection,
  normalizeStoredStudent,
  normalizeStoredFaculty,
  normalizeStudentLinkedRows,
  stripWorkspaceUserProfileFields,
  parseTenantScopedStorageKey,
  tenantCollectionKey,
  WORKSPACES_COLLECTION,
  type HasanatDistributionLike,
  type NamedEntity,
  type SessionLike,
  type Workspace,
} from "@mms/shared";
import {
  getCollectionByStorageName,
  listCollectionStorageNames,
  saveCollection,
} from "../database.js";
/** Historical document-store collection key (pre-faculty rename). */
const LEGACY_COLLECTION_KEY = "teachers";

type Row = Record<string, unknown>;

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

function asNamed(rows: Row[]): NamedEntity[] {
  return rows.map((row) => ({
    id: row.id as string | number,
    name: row.name as string | undefined,
  }));
}

function linkHasanatRecipient(
  row: HasanatDistributionLike,
  students: NamedEntity[],
  facultyMembers: NamedEntity[],
): HasanatDistributionLike {
  if (row.recipientStudentId || row.recipientFacultyId) return row;
  const name = String(row.recipientName ?? "").trim();
  if (!name) return row;
  if (row.recipientType === "faculty") {
    const faculty = facultyMembers.find((entry) => entry.name === name);
    if (faculty) return { ...row, recipientFacultyId: String(faculty.id) };
  } else {
    const student = students.find((entry) => entry.name === name);
    if (student) return { ...row, recipientStudentId: String(student.id) };
  }
  return row;
}

function normalizeTenantCollections(collections: Record<string, Row[]>): {
  next: Record<string, Row[]>;
  changed: boolean;
} {
  const students = asNamed(collections.students ?? []);
  const facultyMembers = asNamed(collections.faculty ?? collections[LEGACY_COLLECTION_KEY] ?? []);
  let changed = false;

  const apply = (key: string, rows: Row[]): Row[] => {
    let next: Row[];
    switch (key) {
      case "students":
        next = rows.map((row) => normalizeStoredStudent(row));
        break;
      case "faculty":
      case LEGACY_COLLECTION_KEY:
        next = rows.map((row) => normalizeStoredFaculty(row));
        break;
      case "enrollments":
      case "attendance_records":
      case "finance_invoices":
        next = normalizeStudentLinkedRows(rows);
        break;
      case "finance_payments":
        next = normalizeStudentLinkedRows(rows, "studentId", "studentName");
        break;
      case "sessions":
        next = normalizeSessionsCollection(rows as SessionLike[]) as Row[];
        break;
      case "users":
        next = rows.map((row) => stripWorkspaceUserProfileFields(row));
        break;
      case "user_activity_logs":
        next = rows.map((row) => normalizeActivityLog(row));
        break;
      case "hasanat_distributions":
        next = rows
          .map((row) =>
            linkHasanatRecipient(row as HasanatDistributionLike, students, facultyMembers),
          )
          .map((row) => normalizeHasanatDistribution(row as HasanatDistributionLike));
        break;
      case "hasanat_redemptions":
        next = rows.map((row) => normalizeHasanatRedemption(row));
        break;
      case "assessment_results":
        next = rows.map((row) => normalizeAssessmentResult(row));
        break;
      default:
        return rows;
    }
    if (JSON.stringify(next) !== JSON.stringify(rows)) changed = true;
    return next;
  };

  const nextCollections: Record<string, Row[]> = {};
  for (const [key, rows] of Object.entries(collections)) {
    nextCollections[key] = apply(key, rows);
  }

  return { next: nextCollections, changed };
}

async function loadTenantCollections(prefix: string): Promise<Record<string, Row[]>> {
  const names = await listCollectionStorageNames();
  const collections: Record<string, Row[]> = {};
  for (const storageName of names) {
    let logical: string | null = null;
    if (prefix) {
      if (!storageName.startsWith(prefix)) continue;
      logical = storageName.slice(prefix.length);
    } else if (!storageName.startsWith("t:")) {
      logical = storageName;
    }
    if (!logical) continue;
    const collectionRows = await getCollectionByStorageName(storageName);
    if (Array.isArray(collectionRows)) collections[logical] = collectionRows as Row[];
  }
  return collections;
}

/**
 * Strips duplicated person profile fields across module collections (contact-first policy).
 */
export async function runMigration006(): Promise<void> {
  const subdomains = await discoverTenantSubdomains();
  let changed = false;

  const migrateStorage = async (prefix: string) => {
    const collections = await loadTenantCollections(prefix);
    const { next, changed: tenantChanged } = normalizeTenantCollections(collections);
    if (!tenantChanged) return;
    for (const [logical, rows] of Object.entries(next)) {
      await saveCollection(prefix ? `${prefix}${logical}` : logical, rows);
    }
    changed = true;
  };

  if (subdomains.size === 0) {
    await migrateStorage("");
  } else {
    for (const subdomain of subdomains) {
      await migrateStorage(tenantCollectionKey(subdomain, ""));
    }
  }

  if (changed) {
    console.log("[Migration 006] Applied contact-first normalization across module collections.");
  }
}

import {
  normalizeActivityLog,
  normalizeAssessmentResult,
  normalizeHasanatDistribution,
  normalizeHasanatPayout,
  normalizeHasanatRedemption,
  normalizeSessionsCollection,
  normalizeStoredStudent,
  normalizeStoredFaculty,
  normalizeStudentLinkedRows,
  normalizeUserActorField,
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

function linkUserActor(
  row: Row,
  users: NamedEntity[],
  userIdField: string,
  labelField: string,
): Row {
  if (row[userIdField]) return row;
  const label = String(row[labelField] ?? "").trim();
  if (!label) return row;
  const user = users.find((entry) => entry.name === label);
  if (!user) return row;
  return { ...row, [userIdField]: String(user.id) };
}

function normalizeTenantCollections(collections: Record<string, Row[]>): {
  next: Record<string, Row[]>;
  changed: boolean;
} {
  const students = asNamed(collections.students ?? []);
  const facultyMembers = asNamed(collections.faculty ?? collections[LEGACY_COLLECTION_KEY] ?? []);
  const users = asNamed(collections.users ?? []);
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
        next = normalizeStudentLinkedRows(rows, "studentId", "studentName").map((row) =>
          normalizeUserActorField(
            linkUserActor(row, users, "receivedByUserId", "receivedBy"),
            "receivedByUserId",
            "receivedBy",
          ),
        );
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
          .map((row) => linkUserActor(row, users, "issuedByUserId", "issuedBy"))
          .map((row) =>
            normalizeUserActorField(
              normalizeHasanatDistribution(row as HasanatDistributionLike),
              "issuedByUserId",
              "issuedBy",
            ),
          );
        break;
      case "hasanat_redemptions":
        next = rows
          .map((row) => normalizeHasanatRedemption(row))
          .map((row) =>
            normalizeUserActorField(
              linkUserActor(row, users, "approvedByUserId", "approvedBy"),
              "approvedByUserId",
              "approvedBy",
            ),
          );
        break;
      case "hasanat_batches":
        next = rows.map((row) =>
          normalizeUserActorField(
            linkUserActor(row, users, "addedByUserId", "addedBy"),
            "addedByUserId",
            "addedBy",
          ),
        );
        break;
      case "hasanat_payouts":
        next = rows
          .map((row) => normalizeHasanatPayout(row))
          .map((row) =>
            normalizeUserActorField(
              linkUserActor(row, users, "approvedByUserId", "approvedBy"),
              "approvedByUserId",
              "approvedBy",
            ),
          );
        break;
      case "assessment_results":
      case "exam_results":
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

/** Extends contact-first normalization: actor user ids, exam results, hasanat batches/payouts. */
export async function runMigration007(): Promise<void> {
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

  await migrateStorage("");
  for (const subdomain of subdomains) {
    await migrateStorage(tenantCollectionKey(subdomain, ""));
  }

  if (changed) {
    console.log("[Migration 007] Contact-linked actor fields and collections normalized.");
  }
}

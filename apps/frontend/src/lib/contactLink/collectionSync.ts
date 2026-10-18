import type { ContactLike, NamedEntity } from "@mms/shared";
import {
  createHasanatDistributionLookupMap,
  createNamedEntityLookupMap,
  hydrateActivityLogList,
  hydrateAssessmentResultList,
  hydrateHasanatDistribution,
  hydrateHasanatPayout,
  hydrateHasanatRedemption,
  hydrateSessionClasses,
  hydrateSessionsCollection,
  hydrateStudentListFromContacts,
  hydrateStudentLinkedRows,
  hydrateFacultyListFromContacts,
  hydrateUserActorField,
  hydrateWorkspaceUserProfileList,
  normalizeActivityLog,
  normalizeAssessmentResult,
  normalizeHasanatDistribution,
  normalizeHasanatPayout,
  normalizeHasanatRedemption,
  normalizeSessionClasses,
  normalizeSessionsCollection,
  normalizeStoredStudent,
  normalizeStoredFaculty,
  normalizeStudentLinkedRows,
  normalizeUserActorField,
  stripWorkspaceUserProfileFields,
  type HasanatDistributionLike,
  type SessionLike,
} from "@mms/shared";

type Row = Record<string, unknown>;

function asNamed(rows: Row[]): NamedEntity[] {
  return rows.map((row) => ({
    id: row.id as string | number,
    name: row.name as string | undefined,
  }));
}

function asNamedMap(rows: Row[]): Map<string, NamedEntity> {
  return createNamedEntityLookupMap(asNamed(rows));
}

function withUserActor(
  row: Row,
  userIdField: string,
  labelField: string,
  users: NamedEntity[] | Map<string, NamedEntity>,
  hydrate: boolean,
): Row {
  return hydrate
    ? hydrateUserActorField(row, userIdField, labelField, users)
    : normalizeUserActorField(row, userIdField, labelField);
}

export function normalizeCollectionRows(key: string, rows: Row[]): Row[] {
  if (!rows || !Array.isArray(rows)) return [];
  switch (key) {
    case "students":
      return rows.map((row) => normalizeStoredStudent(row));
    case "faculty":
      return rows.map((row) => normalizeStoredFaculty(row));
    case "enrollments":
    case "attendance_records":
    case "finance_invoices":
      return normalizeStudentLinkedRows(rows);
    case "finance_payments":
      return normalizeStudentLinkedRows(rows, "studentId", "studentName").map((row) =>
        normalizeUserActorField(row, "receivedByUserId", "receivedBy"),
      );
    case "sessions":
      return normalizeSessionsCollection(rows as SessionLike[]) as Row[];
    case "users":
      return rows.map((row) => stripWorkspaceUserProfileFields(row));
    case "user_activity_logs":
      return rows.map((row) => normalizeActivityLog(row));
    case "hasanat_distributions":
      return rows.map((row) =>
        normalizeUserActorField(
          normalizeHasanatDistribution(row as HasanatDistributionLike),
          "issuedByUserId",
          "issuedBy",
        ),
      );
    case "hasanat_redemptions":
      return rows.map((row) =>
        normalizeUserActorField(normalizeHasanatRedemption(row), "approvedByUserId", "approvedBy"),
      );
    case "hasanat_batches":
      return rows.map((row) => normalizeUserActorField(row, "addedByUserId", "addedBy"));
    case "assessment_results":
    case "exam_results":
      return rows.map((row) => normalizeAssessmentResult(row));
    case "hasanat_payouts":
      return rows.map((row) =>
        normalizeUserActorField(normalizeHasanatPayout(row), "approvedByUserId", "approvedBy"),
      );
    default:
      return rows;
  }
}

export function hydrateCollectionRows(
  key: string,
  rows: Row[],
  context: {
    contacts: ContactLike[];
    students: Row[];
    faculty?: Row[];
    users: Row[];
    distributions: Row[];
  },
): Row[] {
  if (!rows || !Array.isArray(rows)) return [];

  const facultyRows = context.faculty ?? [];

  switch (key) {
    case "students":
      return hydrateStudentListFromContacts(rows as never, context.contacts) as Row[];
    case "faculty":
      return hydrateFacultyListFromContacts(rows as never, context.contacts) as Row[];
    case "enrollments":
    case "attendance_records":
    case "finance_invoices":
      return hydrateStudentLinkedRows(rows, asNamedMap(context.students));
    case "finance_payments": {
      const userMap = asNamedMap(context.users);
      return hydrateStudentLinkedRows(
        rows,
        asNamedMap(context.students),
        "studentId",
        "studentName",
      ).map((row) => withUserActor(row, "receivedByUserId", "receivedBy", userMap, true));
    }
    case "sessions":
      return hydrateSessionsCollection(rows as SessionLike[], asNamedMap(facultyRows)) as Row[];
    case "users":
      return hydrateWorkspaceUserProfileList(rows, context.contacts);
    case "user_activity_logs":
      return hydrateActivityLogList(rows, asNamedMap(context.users));
    case "hasanat_distributions": {
      const userMap = asNamedMap(context.users);
      const studentMap = asNamedMap(context.students);
      const facultyMap = asNamedMap(facultyRows);
      return rows.map((row) =>
        withUserActor(
          hydrateHasanatDistribution(row as HasanatDistributionLike, studentMap, facultyMap),
          "issuedByUserId",
          "issuedBy",
          userMap,
          true,
        ),
      );
    }
    case "hasanat_redemptions": {
      const userMap = asNamedMap(context.users);
      const distMap = createHasanatDistributionLookupMap(
        context.distributions as HasanatDistributionLike[],
      );
      return rows.map((row) =>
        withUserActor(
          hydrateHasanatRedemption(row, distMap),
          "approvedByUserId",
          "approvedBy",
          userMap,
          true,
        ),
      );
    }
    case "hasanat_batches": {
      const userMap = asNamedMap(context.users);
      return rows.map((row) => withUserActor(row, "addedByUserId", "addedBy", userMap, true));
    }
    case "assessment_results":
    case "exam_results":
      return hydrateAssessmentResultList(rows, asNamedMap(context.students));
    case "hasanat_payouts": {
      const userMap = asNamedMap(context.users);
      const studentMap = asNamedMap(context.students);
      return rows.map((row) =>
        withUserActor(
          hydrateHasanatPayout(row, studentMap),
          "approvedByUserId",
          "approvedBy",
          userMap,
          true,
        ),
      );
    }
    default:
      return rows;
  }
}

export function hydrateSessionRowClasses(classes: Row[], faculty: Row[]): Row[] {
  return hydrateSessionClasses(classes, asNamed(faculty)) as Row[];
}

export function normalizeSessionRowClasses(classes: Row[]): Row[] {
  return normalizeSessionClasses(classes) as Row[];
}

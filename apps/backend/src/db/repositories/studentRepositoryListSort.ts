import { sql, type SQL } from "drizzle-orm";
import { students, contacts } from "../schema.js";
import {
  STUDENT_SORT_FIELDS,
  grNumberExpr,
  statusExpr,
  linkedContactGenderExpr,
  linkedContactDobExpr,
  linkedContactNameSortExpr,
} from "./studentRepositoryListQuery.js";

export function buildOrderBy(
  sortField: string | undefined,
  sortDir: "asc" | "desc" | "" | undefined,
  useJoinedContacts = false,
): SQL {
  const dir = sortDir === "desc" ? "desc" : "asc";
  const field = sortField?.trim();
  if (!field || !STUDENT_SORT_FIELDS.has(field)) {
    return sql`${students.id} asc`;
  }
  if (field === "updatedAt") {
    return dir === "desc"
      ? sql`${students.updatedAt} desc nulls last`
      : sql`${students.updatedAt} asc nulls last`;
  }
  if (field === "grNumber") {
    const grSort = grNumberExpr();
    return dir === "desc" ? sql`${grSort} desc nulls last` : sql`${grSort} asc nulls last`;
  }
  if (field === "status") {
    const statusSort = statusExpr();
    return dir === "desc" ? sql`${statusSort} desc nulls last` : sql`${statusSort} asc nulls last`;
  }
  if (field === "gender") {
    const genderSort = useJoinedContacts
      ? sql`lower(trim(COALESCE(${contacts.gender}, '')))`
      : linkedContactGenderExpr();
    return dir === "desc" ? sql`${genderSort} desc nulls last` : sql`${genderSort} asc nulls last`;
  }
  if (field === "dob") {
    const dobSort = useJoinedContacts
      ? sql`NULLIF(trim(COALESCE(${contacts.dob}::text, '')), '')`
      : linkedContactDobExpr();
    return dir === "desc" ? sql`${dobSort} desc nulls last` : sql`${dobSort} asc nulls last`;
  }
  if (field === "name") {
    const nameSort = useJoinedContacts
      ? sql`lower(trim(COALESCE(
          NULLIF(trim(concat_ws(' ', ${contacts.firstName}, ${contacts.lastName})), ''),
          NULLIF(trim(COALESCE(${contacts.name}, '')), ''),
          ''
        )))`
      : linkedContactNameSortExpr();
    return dir === "desc" ? sql`${nameSort} desc nulls last` : sql`${nameSort} asc nulls last`;
  }
  if (field === "studentId") {
    return dir === "desc"
      ? sql`lower(COALESCE(${students.studentId}, '')) desc nulls last`
      : sql`lower(COALESCE(${students.studentId}, '')) asc nulls last`;
  }
  if (field === "registeredDate") {
    return dir === "desc"
      ? sql`lower(COALESCE(${students.registeredDate}, '')) desc nulls last`
      : sql`lower(COALESCE(${students.registeredDate}, '')) asc nulls last`;
  }
  return sql`${students.id} asc`;
}

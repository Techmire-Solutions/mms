/** Faculty list query SQL + page runner + ops — stable barrel. */
export { facultyStatusExpr } from "./facultyRepositoryListQuerySql.js";

export { listFacultyPage } from "./facultyRepositoryListQueryPage.js";

export {
  countFacultyActive,
  countFacultyForNextEmployeeId,
  type NextEmployeeIdCountOptions,
  listActiveFacultyMissingEmployeeId,
  listFacultyLinkedContactIdsSql,
  findSoftDeletedFacultyByContactIdSql,
  findFacultyRegistrationConflictSql,
} from "./facultyRepositoryListQueryOps.js";

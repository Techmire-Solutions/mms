export {
  facultyStatusExpr,
  listFacultyPage,
  countFacultyActive,
  countFacultyForNextEmployeeId,
  type NextEmployeeIdCountOptions,
  listActiveFacultyMissingEmployeeId,
  listFacultyLinkedContactIdsSql,
  findSoftDeletedFacultyByContactIdSql,
  findFacultyRegistrationConflictSql,
} from "./facultyRepositoryListQuery.js";

export {
  bulkUpdateFacultyStatusSql,
  bulkUpdateFacultySpecializationSql,
  aggregateFacultyCommandMetrics,
} from "./facultyRepositoryListOps.js";

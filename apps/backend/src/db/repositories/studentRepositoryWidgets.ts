/** Students widget aggregates + linked-contact / registration SQL — stable barrel. */
export { aggregateStudentsWidgetQueries } from "./studentRepositoryWidgetsAggregate.js";
export {
  listStudentLinkedContactIdsSql,
  countStudentsForNextGrNumber,
  findStudentRegistrationConflictSql,
  findSoftDeletedStudentByContactIdSql,
} from "./studentRepositoryWidgetsOps.js";
export {
  findActiveGrNumberOwnersSql,
  findActiveStudentIdOwnersSql,
} from "./studentRepositoryGrOwners.js";

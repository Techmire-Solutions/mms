/**
 * Drizzle-backed reference lookups the attendance domain needs (students, session classes).
 *
 * Lives in the module's repository layer so the use-cases never import `db/repositories` directly:
 * the composition root binds these, tests bind fakes.
 */
export { findStudentById } from "@mms/mod-students/backend/repository";
export { findStudentsByIds } from "@mms/mod-students/backend/repository";
export {
  findClassById as findSessionById,
  findClassesByIds as findSessionsByIds,
} from "@mms/mod-sessions/backend/repository";

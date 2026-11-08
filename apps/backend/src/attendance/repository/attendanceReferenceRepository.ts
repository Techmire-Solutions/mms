/**
 * Drizzle-backed reference lookups the attendance domain needs (students, session classes).
 *
 * Lives in the module's repository layer so the use-cases never import `db/repositories` directly:
 * the composition root binds these, tests bind fakes.
 */
export { findStudentById } from "../../db/repositories/studentRepositoryHydrate.js";
export { findStudentsByIds } from "../../db/repositories/studentRepository.js";
export {
  findClassById as findSessionById,
  findClassesByIds as findSessionsByIds,
} from "../../db/repositories/sessionRepositoryHydrate.js";

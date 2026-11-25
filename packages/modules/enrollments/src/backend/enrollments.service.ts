import { listEnrollmentsPage } from "./repository/db/enrollmentRepositoryList.js";
import { findEnrollmentById } from "./repository/db/enrollmentRepositoryHydrate.js";

/** Public directory surface for other modules (attendance, finance). */
export const enrollmentsService = {
  listEnrollmentsPage,
  findEnrollmentById,
};

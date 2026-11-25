import { findSessionById } from "./repository/db/sessionRepositoryQueries.js";
import { listSessionsPage } from "./repository/db/sessionRepositoryList.js";

/** Public directory surface for other modules (enrollments, attendance, finance). */
export const sessionsService = {
  findSessionById,
  listSessionsPage,
};

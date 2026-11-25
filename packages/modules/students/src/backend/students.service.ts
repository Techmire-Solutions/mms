import { findStudentsByIds } from "./repository/db/studentRepository.js";

/** Public directory surface for other modules (enrollments, attendance, finance). */
export const studentsService = {
  findStudentsByIds,
};

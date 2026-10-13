/** Linked-entity normalize/hydrate helpers across modules. */
export * from "./linkedSessionUtils.js";
export * from "./linkedStudentRowUtils.js";
export * from "./linkedUserUtils.js";
export * from "./linkedHasanatUtils.js";
export * from "./linkedAssessmentUtils.js";
export * from "./linkedActorUtils.js";
export {
  normalizeStoredStudent,
  hydrateStudentFromContacts,
  hydrateStudentListFromContacts,
} from "../students/studentUtils.js";
export {
  normalizeStoredFaculty,
  hydrateFacultyFromContact,
  hydrateFacultyListFromContacts,
  formatFacultyDisplayName,
} from "../faculty/facultyUtils.js";
export type { Student } from "../students/studentTypes.js";
export type { FacultyMember } from "../faculty/facultyTypes.js";

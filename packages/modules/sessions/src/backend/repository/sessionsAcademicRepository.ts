type CatalogStore = typeof import("../repository/db/academicCatalogRepository.js");
type LinkStore = typeof import("../repository/db/registrationLinkRepository.js");
type SessionQueries = typeof import("../repository/db/sessionRepositoryQueries.js");
type WorkspaceStore = typeof import("../deps.js");
type SectionOpsStore = typeof import("../repository/db/sectionOperationsRepository.js");
type ActivityStore = typeof import("../repository/db/sessionActivityRepository.js");
type ScopeStore = typeof import("../repository/db/teacherSectionScopeRepository.js");
type StaffStore = typeof import("../repository/db/sectionStaffRepository.js");
type StudentRoleStore = typeof import("../repository/db/sectionStudentRolesRepository.js");

/**
 * Storage gateway for the Sessions academic structure added on top of the core sessions
 * repository: catalogs, registration links, section staff / student roles and teacher scope.
 */
export interface SessionsAcademicRepository {
  listAcademicCatalog: CatalogStore["listAcademicCatalog"];
  saveAcademicCatalogItem: CatalogStore["saveAcademicCatalogItem"];
  softDeleteAcademicCatalogItem: CatalogStore["softDeleteAcademicCatalogItem"];
  restoreAcademicCatalogItem: CatalogStore["restoreAcademicCatalogItem"];
  listRegistrationLinks: LinkStore["listRegistrationLinks"];
  saveRegistrationLink: LinkStore["saveRegistrationLink"];
  softDeleteRegistrationLink: LinkStore["softDeleteRegistrationLink"];
  findSessionById: SessionQueries["findSessionById"];
  findWorkspaceTimezone: WorkspaceStore["findWorkspaceTimezone"];
  isFacultyLinked: ScopeStore["isFacultyLinked"];
  findUntaughtClassDates: ScopeStore["findUntaughtClassDates"];
  /** Exact-section staffing check for attendance marks. */
  findUnstaffedSectionDates: ScopeStore["findUnstaffedSectionDates"];
  /** Students the user teaches in a period (excuse privacy scoping); `null` = unscoped staff. */
  listTaughtStudentIds: ScopeStore["listTaughtStudentIds"];
  loadSectionRoster: SectionOpsStore["loadSectionRoster"];
  listSessionActivity: ActivityStore["listSessionActivity"];
  applySectionMerge: SectionOpsStore["applySectionMerge"];
  applySectionSplit: SectionOpsStore["applySectionSplit"];
  applySectionClose: SectionOpsStore["applySectionClose"];
  listSectionStaff: StaffStore["listSectionStaff"];
  assignSectionStaff: StaffStore["assignSectionStaff"];
  endSectionStaff: StaffStore["endSectionStaff"];
  listSectionStudentRoles: StudentRoleStore["listSectionStudentRoles"];
  addSectionStudentRole: StudentRoleStore["addSectionStudentRole"];
  endSectionStudentRole: StudentRoleStore["endSectionStudentRole"];
}

/** A mark's exact placement: the section is what a teacher is actually staffed on. */
export type { ClassSectionDate } from "../repository/db/teacherSectionScopeRepository.js";

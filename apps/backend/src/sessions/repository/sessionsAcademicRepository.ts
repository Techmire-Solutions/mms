type CatalogStore = typeof import("../../db/repositories/academicCatalogRepository.js");
type LinkStore = typeof import("../../db/repositories/registrationLinkRepository.js");
type SessionQueries = typeof import("../../db/repositories/sessionRepositoryQueries.js");
type ScopeStore = typeof import("../../db/repositories/teacherSectionScopeRepository.js");
type StaffStore = typeof import("../../db/repositories/sectionStaffRepository.js");
type StudentRoleStore = typeof import("../../db/repositories/sectionStudentRolesRepository.js");

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
  findUntaughtClassDates: ScopeStore["findUntaughtClassDates"];
  listSectionStaff: StaffStore["listSectionStaff"];
  assignSectionStaff: StaffStore["assignSectionStaff"];
  endSectionStaff: StaffStore["endSectionStaff"];
  listSectionStudentRoles: StudentRoleStore["listSectionStudentRoles"];
  addSectionStudentRole: StudentRoleStore["addSectionStudentRole"];
  endSectionStudentRole: StudentRoleStore["endSectionStudentRole"];
}

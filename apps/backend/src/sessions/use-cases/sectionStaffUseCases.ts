import { sessionsAcademicRepository as repo } from "../repository/sessionsAcademicRepositoryAdapter.js";

/** Section staff (effective-dated teacher assignments) and student roles (monitors). */
export const listSectionStaff = repo.listSectionStaff;
export const assignSectionStaff = repo.assignSectionStaff;
export const endSectionStaff = repo.endSectionStaff;
export const listSectionStudentRoles = repo.listSectionStudentRoles;
export const addSectionStudentRole = repo.addSectionStudentRole;
export const endSectionStudentRole = repo.endSectionStudentRole;

import { sql } from "drizzle-orm";
import { exams, sessionClassTimetablePeriods, sessions } from "../schema.js";

/**
 * Display names derived from catalog ids (migration 0181 dropped the text snapshots). Archived
 * catalog entries keep their name, so historic rows still read correctly.
 */

/** Session "type": its program's name, or `academic` when the session has no program. */
export const sessionTypeSql = sql<string>`COALESCE((SELECT p.name FROM programs p
  WHERE p.workspace_subdomain = ${sessions.workspaceSubdomain} AND p.id = ${sessions.programId}), 'academic')`;

/** Exam subject name ('' when the exam has no subject). */
export const examSubjectSql = sql<string>`COALESCE((SELECT j.name FROM subjects j
  WHERE j.workspace_subdomain = ${exams.workspaceSubdomain} AND j.id = ${exams.subjectId}), '')`;

/** Timetable period subject name ('' when the period has no subject). */
export const periodSubjectSql = sql<string>`COALESCE((SELECT j.name FROM subjects j
  WHERE j.workspace_subdomain = ${sessionClassTimetablePeriods.workspaceSubdomain}
    AND j.id = ${sessionClassTimetablePeriods.subjectId}), '')`;

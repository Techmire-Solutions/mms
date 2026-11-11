import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb } from "../db/database.js";
import { getDb } from "../db/dbClient.js";
import {
  enrollments,
  examClasses,
  exams,
  sessionClasses,
  sessions,
  students,
} from "../db/schema.js";

loadBackendEnv();

/**
 * Self-contained Examinations E2E fixture: one seated student, one class and one exam.
 * Idempotent; used by `e2e/tests/features/examinations-marks-entry.spec.ts`.
 */
async function main() {
  const subdomain = process.argv[2];
  if (!subdomain) {
    console.error("Missing subdomain argument");
    process.exit(1);
  }
  await initDb();
  const db = getDb();
  const sessionId = "e2e-session";
  const classId = "e2e-class";
  const studentId = "e2e-student";
  const examId = "e2e-midterm";

  await db
    .insert(sessions)
    .values({
      id: sessionId,
      workspaceSubdomain: subdomain,
      name: "E2E Session",
      status: "in_progress",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      baseFee: "0",
      currency: "PKR",
    })
    .onConflictDoUpdate({
      target: [sessions.workspaceSubdomain, sessions.id],
      set: { status: "in_progress", deletedAt: null },
    });
  await db
    .insert(sessionClasses)
    .values({ id: classId, workspaceSubdomain: subdomain, sessionId, name: "E2E Class" })
    .onConflictDoUpdate({
      target: [sessionClasses.workspaceSubdomain, sessionClasses.id],
      set: { name: "E2E Class" },
    });
  await db
    .insert(students)
    .values({ id: studentId, workspaceSubdomain: subdomain, grNumber: "E2E-1", status: "active" })
    .onConflictDoUpdate({
      target: [students.workspaceSubdomain, students.id],
      set: { status: "active", deletedAt: null },
    });
  await db
    .insert(enrollments)
    .values({
      id: "e2e-enrollment",
      workspaceSubdomain: subdomain,
      studentId,
      studentName: "E2E Student",
      sessionId,
      sessionName: "E2E Session",
      classId,
      status: "confirmed",
      enrolledDate: "2026-01-01",
    })
    .onConflictDoUpdate({
      target: [enrollments.workspaceSubdomain, enrollments.id],
      set: { status: "confirmed", deletedAt: null },
    });
  await db
    .insert(exams)
    .values({
      id: examId,
      workspaceSubdomain: subdomain,
      name: "E2E Midterm",
      totalMarks: 100,
      passingMarks: 50,
      date: "2026-12-01",
      duration: 60,
      status: "ongoing",
      description: "Seed exam for the marks-entry E2E",
    })
    .onConflictDoUpdate({
      target: [exams.workspaceSubdomain, exams.id],
      set: {
        name: "E2E Midterm",
        totalMarks: 100,
        passingMarks: 50,
        status: "ongoing",
        resultsFinalizedAt: null,
        deletedAt: null,
      },
    });
  await db
    .insert(examClasses)
    .values({ workspaceSubdomain: subdomain, examId, classId })
    .onConflictDoNothing();
  console.log(`Seeded exam ${examId}, class ${classId} and student ${studentId} for ${subdomain}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

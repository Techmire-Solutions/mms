import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb } from "../db/database.js";
import { getDb } from "../db/dbClient.js";
import { sessions, sessionClasses, enrollments, students, contacts } from "../db/schema.js";
import { eq } from "drizzle-orm";

loadBackendEnv();

async function main() {
  const subdomain = process.argv[2];
  if (!subdomain) {
    console.error("Missing subdomain argument");
    process.exit(1);
  }

  console.log(`Seeding session, class, and enrollment for subdomain: "${subdomain}"...`);
  await initDb();
  const db = getDb();

  // 1. Find contact Jane Doe
  const contactRows = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      name: contacts.name,
    })
    .from(contacts)
    .where(eq(contacts.workspaceSubdomain, subdomain));
  console.log(`Found ${contactRows.length} contact rows in database.`);
  const janeContact = contactRows.find((r) => {
    return (
      String(r.firstName || "")
        .toLowerCase()
        .includes("jane") ||
      String(r.name || "")
        .toLowerCase()
        .includes("jane")
    );
  });

  if (!janeContact) {
    console.error("Could not find contact Jane Doe.");
    process.exit(1);
  }

  // 2. Find or create student record for Jane Doe
  const studentRows = await db
    .select({
      id: students.id,
      contactId: students.contactId,
    })
    .from(students)
    .where(eq(students.workspaceSubdomain, subdomain));
  // (typed as { id } because only the student id is consumed below;
  //  the non-null literal keeps the extra columns written to the DB above)
  let janeStudent: { id: string } | undefined = studentRows.find(
    (r) => r.contactId === janeContact.id,
  );
  if (!janeStudent) {
    console.log("Creating student record for Jane Doe...");
    const studentId = `std-jane-${Date.now()}`;
    await db.insert(students).values({
      id: studentId,
      workspaceSubdomain: subdomain,
      contactId: janeContact.id,
      status: "active",
      registeredDate: "2026-01-01",
      grNumber: "GR-0001",
    });
    janeStudent = { id: studentId, workspaceSubdomain: subdomain, contactId: janeContact.id } as {
      id: string;
    };
  }

  const sessionId = "sess-hifz-2026";
  const classId = "c1";
  const enrollmentId = "enr-jane-c1";

  // 3. Insert session with class
  await db
    .insert(sessions)
    .values({
      id: sessionId,
      workspaceSubdomain: subdomain,
      name: "Quran Hifz Session 2026",
      type: "Hifz",
      status: "active",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      baseFee: "1000",
      currency: "PKR",
    })
    .onConflictDoUpdate({
      target: [sessions.workspaceSubdomain, sessions.id],
      set: {
        name: "Quran Hifz Session 2026",
        type: "Hifz",
        status: "active",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        baseFee: "1000",
        currency: "PKR",
      },
    });

  await db
    .insert(sessionClasses)
    .values({
      id: classId,
      workspaceSubdomain: subdomain,
      sessionId: sessionId,
      name: "Morning Quran Class",
      ageMin: 5,
      ageMax: 18,
      gender: "any",
      facultyId: "",
      facultyName: "Unassigned",
      capacity: 20,
      enrolled: 1,
    })
    .onConflictDoUpdate({
      target: [sessionClasses.workspaceSubdomain, sessionClasses.sessionId, sessionClasses.id],
      set: {
        name: "Morning Quran Class",
        ageMin: 5,
        ageMax: 18,
        gender: "any",
        facultyId: "",
        facultyName: "Unassigned",
        capacity: 20,
        enrolled: 1,
      },
    });

  if (!janeStudent) {
    throw new Error("Could not find or create student for Jane Doe");
  }

  // 4. Insert enrollment for Jane Doe in class c1
  await db
    .insert(enrollments)
    .values({
      id: enrollmentId,
      workspaceSubdomain: subdomain,
      studentId: janeStudent.id,
      studentName: "Jane Doe",
      classId: classId,
      className: "Morning Quran Class",
      sessionId: sessionId,
      sessionName: "Quran Hifz Session 2026",
      status: "confirmed",
      enrolledDate: new Date().toISOString().split("T")[0] ?? "",
    })
    .onConflictDoUpdate({
      target: [enrollments.workspaceSubdomain, enrollments.id],
      set: {
        studentId: janeStudent.id,
        studentName: "Jane Doe",
        classId: classId,
        className: "Morning Quran Class",
        sessionId: sessionId,
        sessionName: "Quran Hifz Session 2026",
        status: "confirmed",
        enrolledDate: new Date().toISOString().split("T")[0] ?? "",
        updatedAt: new Date(),
      },
    });

  console.log("Seeding completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

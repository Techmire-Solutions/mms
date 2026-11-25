import { loadBackendEnv } from "../config/loadEnv.js";
import { initializeDatabase } from "../bootstrap/initializeDatabase.js";
import { configureModuleAdapters } from "../bootstrap/configureModuleAdapters.js";
import { getDb } from "@mms/db/client";
import { workspaces } from "@mms/db/schema";
import { bulkSaveStudents } from "@mms/mod-students/backend/repository";
import type { Student } from "@mms/contracts";

loadBackendEnv();

/**
 * Seeds 20 deterministic students into a tenant so the a11y gate can audit a *populated*
 * students Work table — the empty-tenant blind spot in `docs/a11y-baseline.md`.
 *
 * Each student is linked 1:1 to a seeded contact (`c-seed-dummy-{n}`, see `seed-20-contacts.ts`),
 * so run the contacts seed first. Idempotent: fixed ids + `onConflictDoUpdate`, so re-running
 * cannot duplicate rows (the (subdomain, contact_id) unique index would otherwise reject them).
 */
const STUDENT_COUNT = 20;

async function main() {
  configureModuleAdapters();
  await initializeDatabase();
  const db = getDb();

  const argSubdomain = process.argv[2]?.trim().toLowerCase();
  let subdomainsToSeed: string[];

  if (argSubdomain && argSubdomain !== "all") {
    subdomainsToSeed = [argSubdomain];
  } else {
    const allWorkspaces = await db.select({ subdomain: workspaces.subdomain }).from(workspaces);
    subdomainsToSeed = Array.from(new Set(allWorkspaces.map((w) => w.subdomain)));
  }

  for (const subdomain of subdomainsToSeed) {
    console.log(`Seeding ${STUDENT_COUNT} dummy students for tenant subdomain: "${subdomain}"...`);

    const students: Student[] = Array.from({ length: STUDENT_COUNT }, (_, index) => {
      const n = index + 1;
      return {
        id: `s-seed-dummy-${n}`,
        contactId: `c-seed-dummy-${n}`,
        status: "active",
        grNumber: `GR-SEED-${String(n).padStart(2, "0")}`,
        registeredDate: "2026-01-01",
        enrollmentDate: "2026-01-01",
        notes: `Seeded student ${n} for the populated a11y sweep.`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Student;
    });

    await bulkSaveStudents(subdomain, students);
    console.log(`Successfully seeded ${STUDENT_COUNT} students into workspace "${subdomain}"!`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed students:", err);
  process.exit(1);
});

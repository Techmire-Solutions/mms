import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb } from "../db/database.js";
import { getDb } from "../db/dbClient.js";
import { workspaces } from "../db/schema.js";
import { bulkSaveFaculty } from "../db/repositories/facultyRepository.js";
import type { FacultyMember } from "@mms/shared";

loadBackendEnv();

/**
 * Seeds 20 deterministic faculty members into a tenant so the a11y gate can audit a *populated*
 * faculty Work table — the empty-tenant blind spot in `docs/a11y-baseline.md`.
 *
 * Each member links 1:1 to a seeded contact (`c-seed-dummy-{n}`) and to the `dept-default` /
 * `desig-default` catalog rows, so `seed-20-contacts.ts` and `seed-faculty-setup.ts` must run first.
 * `bulkSaveFaculty` writes the employment + employ-designation chain from these flat fields.
 * Idempotent (fixed ids `f-seed-*`).
 */
const FACULTY_COUNT = 20;

async function main() {
  await initDb();
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
    console.log(`Seeding ${FACULTY_COUNT} dummy faculty for tenant subdomain: "${subdomain}"...`);

    const members: FacultyMember[] = Array.from({ length: FACULTY_COUNT }, (_, index) => {
      const n = index + 1;
      return {
        id: `f-seed-${n}`,
        contactId: `c-seed-dummy-${n}`,
        name: `Seeded Faculty ${String(n).padStart(2, "0")}`,
        employeeId: `FAC-SEED-${String(n).padStart(4, "0")}`,
        status: "active",
        profileStatus: "active",
        specialization: "General",
        departmentId: "dept-default",
        department: "General",
        designationId: "desig-default",
        designation: "Teacher",
        employDesignationStatus: "active",
        employmentStartDate: "2026-01-01",
        qualification: "Ijazah",
      };
    });

    await bulkSaveFaculty(subdomain, members);
    console.log(`Successfully seeded ${FACULTY_COUNT} faculty into workspace "${subdomain}"!`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed faculty:", err);
  process.exit(1);
});

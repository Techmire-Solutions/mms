import { loadBackendEnv } from "../config/loadEnv.js";
import { initializeDatabase } from "../bootstrap/initializeDatabase.js";
import { getDb } from "@mms/db/client";
import { workspaces } from "@mms/db/schema";
import { bulkSaveContacts } from "@mms/mod-contacts/backend/repository";
import { stripContactRetiredClassificationFields, type Contact } from "@mms/contracts";
import { SEED_20_DUMMY_CONTACTS } from "./seed-20-contacts-data.js";

loadBackendEnv();

const DUMMY_CONTACTS = SEED_20_DUMMY_CONTACTS;

async function main() {
  await initializeDatabase();
  const db = getDb();

  const argSubdomain = process.argv[2]?.trim().toLowerCase();
  let subdomainsToSeed: string[];

  if (argSubdomain && argSubdomain !== "all") {
    subdomainsToSeed = [argSubdomain];
  } else {
    // Seed all existing workspaces in the database
    const allWorkspaces = await db.select({ subdomain: workspaces.subdomain }).from(workspaces);
    subdomainsToSeed = Array.from(new Set(allWorkspaces.map((w) => w.subdomain)));
  }

  for (const subdomain of subdomainsToSeed) {
    console.log(
      `Seeding 20 complete dummy contacts into local database for tenant subdomain: "${subdomain}"...`,
    );
    const preparedContacts: Contact[] = DUMMY_CONTACTS.map(
      (draft, idx) =>
        ({
          ...stripContactRetiredClassificationFields({ ...draft } as Record<string, unknown>),
          id: `c-seed-dummy-${idx + 1}`,
        }) as Contact,
    );

    await bulkSaveContacts(subdomain, preparedContacts);
    console.log(`Successfully seeded 20 complete dummy contacts into workspace "${subdomain}"!`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed contacts:", err);
  process.exit(1);
});

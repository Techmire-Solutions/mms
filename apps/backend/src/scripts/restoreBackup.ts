import fs from "node:fs";
import path from "node:path";
import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb, closeDatabase } from "../db/database.js";
import {
  decryptWorkspaceBackup,
  parseStorageKeysToSnapshot,
  validateAndNormalizeSnapshot,
} from "@mms/shared";
import { runWithTenant, bindRequestTenant } from "../lib/tenantContext.js";
import { synchronizeData } from "../services/dbSyncService.js";
import { getDb } from "../db/dbClient.js";
import {
  contacts,
  contactPhones,
  contactEmails,
  contactAddresses,
  contactRelationships,
  students,
  faculty,
  tenantUsers,
  workspaces,
} from "../db/schema.js";
import { eq } from "drizzle-orm";

loadBackendEnv();

async function runRestore() {
  console.log("--- Step 1: Initializing Database Connection ---");
  await initDb();
  const db = getDb();

  console.log("--- Step 2: Reading & Decrypting Backup File ---");
  const backupFilePath = path.resolve(process.cwd(), "../../mms_backup_dq_2026-08-18.mmsbak");
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found at: ${backupFilePath}`);
  }

  const fileContent = fs.readFileSync(backupFilePath, "utf8");
  const adminEmail = process.env.ADMIN_EMAIL || process.argv[2];
  const password = process.env.ADMIN_PASSWORD || process.argv[3];
  if (!adminEmail || !password) {
    throw new Error(
      "Please provide admin email and password via ADMIN_EMAIL/ADMIN_PASSWORD env vars or CLI arguments.",
    );
  }

  const creds = {
    adminEmail,
    password,
  };

  const decryptResult = await decryptWorkspaceBackup(fileContent, creds);
  if (!decryptResult.ok) {
    throw new Error(`Decryption failed: ${decryptResult.errorKey}`);
  }
  console.log("✅ Successfully decrypted backup file!");

  const parsedEnvelope = JSON.parse(decryptResult.plaintext);
  const subdomain = parsedEnvelope.subdomain || "dq";
  console.log(`Target Tenant Subdomain: "${subdomain}"`);

  // Ensure workspace exists
  const existingWs = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.subdomain, subdomain))
    .limit(1);
  if (existingWs.length === 0) {
    console.log(`Creating workspace "${subdomain}"...`);
    await db.insert(workspaces).values({
      id: `ws-${subdomain}`,
      subdomain,
      madrasaName: parsedEnvelope.tenantLabel || "Dar Ul Quran",
      enabled: true,
    });
  }

  console.log("--- Step 3: Parsing & Normalizing Snapshot ---");
  const snapshot = parseStorageKeysToSnapshot(parsedEnvelope.keys, `mms_t:${subdomain}:`);
  const validated = validateAndNormalizeSnapshot(snapshot);
  if (!validated.ok) {
    throw new Error(`Validation failed: ${validated.errorKey}`);
  }
  console.log(
    `✅ Snapshot validated: ${Object.keys(validated.data.collections || {}).length} collections, ${Object.keys(validated.data.objects || {}).length} objects.`,
  );

  console.log("--- Step 4: Synchronizing Data to Local Database ---");
  await runWithTenant(subdomain, async () => {
    bindRequestTenant(subdomain);
    await synchronizeData(validated.data, undefined, false);
  });
  console.log("✅ Data synchronization completed successfully!");

  console.log("--- Step 5: Verifying Restored Database Records ---");
  const restoredContacts = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.workspaceSubdomain, subdomain));
  const restoredPhones = await db
    .select({ id: contactPhones.id })
    .from(contactPhones)
    .where(eq(contactPhones.workspaceSubdomain, subdomain));
  const restoredEmails = await db
    .select({ id: contactEmails.id })
    .from(contactEmails)
    .where(eq(contactEmails.workspaceSubdomain, subdomain));
  const restoredAddresses = await db
    .select({ id: contactAddresses.id })
    .from(contactAddresses)
    .where(eq(contactAddresses.workspaceSubdomain, subdomain));
  const restoredRels = await db
    .select({ id: contactRelationships.id })
    .from(contactRelationships)
    .where(eq(contactRelationships.workspaceSubdomain, subdomain));
  const restoredStudents = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.workspaceSubdomain, subdomain));
  const restoredFaculty = await db
    .select({ id: faculty.id })
    .from(faculty)
    .where(eq(faculty.workspaceSubdomain, subdomain));
  const restoredUsers = await db
    .select({
      id: tenantUsers.id,
      loginEmail: tenantUsers.loginEmail,
      role: tenantUsers.role,
    })
    .from(tenantUsers)
    .where(eq(tenantUsers.workspaceSubdomain, subdomain));

  const { listContactsByWorkspace } = await import("../db/repositories/contactRepository.js");
  const { listStudentsByWorkspace } = await import("../db/repositories/studentRepository.js");
  const { listFacultyByWorkspace } = await import("../db/repositories/facultyRepository.js");

  const hydratedContacts = await listContactsByWorkspace(subdomain);
  const hydratedStudents = await listStudentsByWorkspace(subdomain);
  const hydratedFaculty = await listFacultyByWorkspace(subdomain);

  console.log(`\n================ RESTORE SUMMARY (${subdomain}) ================`);
  console.log(`Contacts in DB: ${restoredContacts.length} (Hydrated: ${hydratedContacts.length})`);
  hydratedContacts.forEach((c, i) => {
    const phones = (c.phones || []).map((p) => p.number).join(", ") || "None";
    const emails = (c.emails || []).map((e) => e.address).join(", ") || "None";
    console.log(`  [${i + 1}] ${c.name} | Phone: ${phones} | Email: ${emails} | ID: ${c.id}`);
  });
  console.log(`\nContact Phones: ${restoredPhones.length}`);
  console.log(`Contact Emails: ${restoredEmails.length}`);
  console.log(`Contact Addresses: ${restoredAddresses.length}`);
  console.log(`Contact Relationships: ${restoredRels.length}`);

  console.log(
    `\nStudents in DB: ${restoredStudents.length} (Hydrated: ${hydratedStudents.length})`,
  );
  hydratedStudents.forEach((s, i) => {
    const contactObj = s.contact as { name?: string } | undefined;
    console.log(
      `  [${i + 1}] GR: ${s.grNumber} | Contact: ${contactObj?.name || s.contactId} | Status: ${s.status} (ID: ${s.id})`,
    );
  });

  console.log(`\nFaculty in DB: ${restoredFaculty.length} (Hydrated: ${hydratedFaculty.length})`);
  hydratedFaculty.forEach((t, i) => {
    const contactObj = t.contact as { name?: string } | undefined;
    console.log(
      `  [${i + 1}] Employee ID: ${t.employeeId} | Contact: ${contactObj?.name || t.contactId} | Status: ${t.status} (ID: ${t.id})`,
    );
  });

  console.log(`\nTenant Users: ${restoredUsers.length}`);
  restoredUsers.forEach((u, i) =>
    console.log(`  [${i + 1}] Email: ${u.loginEmail} | Role: ${u.role} (ID: ${u.id})`),
  );
  console.log("=======================================================\n");

  await closeDatabase();
}

runRestore().catch(async (err) => {
  console.error("❌ Restore failed with error:", err);
  try {
    await closeDatabase();
  } catch (closeErr) {
    console.error("Failed to close database:", closeErr);
  }
  process.exit(1);
});

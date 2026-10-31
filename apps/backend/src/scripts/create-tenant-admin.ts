import { loadBackendEnv } from "../config/loadEnv.js";
import { initializeDatabaseConnection, getRootDb, closeDatabase } from "../db/dbConnection.js";
import { tenantUsers } from "../db/schema.js";
import { hashPassword } from "../services/auth/passwordService.js";
import { randomBytes, randomInt } from "node:crypto";
import { eq, and } from "drizzle-orm";

loadBackendEnv();

function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "DQ-";
  for (let i = 0; i < 12; i++) {
    // CSPRNG: this is an initial admin credential, so a predictable PRNG is unsafe.
    password += chars.charAt(randomInt(chars.length));
  }
  return password;
}

async function run() {
  const args = process.argv.slice(2);
  const subdomain = args[0] || "darulquran";
  const email = args[1] || "admin@darulquran.com";
  const password = args[2] || generatePassword();

  console.log(`Initializing database connection...`);
  initializeDatabaseConnection();
  const db = getRootDb();

  const passwordHash = await hashPassword(password);

  // Find if user already exists
  const existing = await db
    .select({
      id: tenantUsers.id,
      loginEmail: tenantUsers.loginEmail,
    })
    .from(tenantUsers)
    .where(and(eq(tenantUsers.workspaceSubdomain, subdomain), eq(tenantUsers.loginEmail, email)))
    .limit(1);

  if (existing.length > 0) {
    const user = existing[0];
    await db
      .update(tenantUsers)
      .set({
        passwordHash,
        role: "admin",
        deletedAt: null,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(tenantUsers.id, user.id));
    console.log(`\n✅ Updated existing admin user on subdomain "${subdomain}"`);
  } else {
    const id = randomBytes(8).toString("hex");
    const displaySubdomain = subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
    await db.insert(tenantUsers).values({
      id,
      workspaceSubdomain: subdomain,
      loginEmail: email,
      passwordHash,
      name: `${displaySubdomain} Admin`,
      role: "admin",
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`\n✅ Created new admin user on subdomain "${subdomain}"`);
  }

  console.log(`Email: ${email}`);
  console.log(`Password: ${password}\n`);

  await closeDatabase();
}

run().catch((err) => {
  console.error("Failed to create tenant admin:", err);
  process.exit(1);
});

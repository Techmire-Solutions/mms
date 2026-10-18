import { loadBackendEnv } from "../config/loadEnv.js";
import { hashPassword } from "../services/auth/passwordService.js";
import {
  insertPlatformUser,
  findPlatformUserRowByEmail,
  updatePlatformUserRow,
} from "../db/repositories/platformUserRepository.js";
import { initDb, closeDatabase } from "../db/database.js";
import { randomBytes } from "node:crypto";
import { FULL_PLATFORM_ADMIN_PERMISSIONS } from "@mms/shared";

loadBackendEnv();

async function seed() {
  await initDb();
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim();
  const password = process.env.PLATFORM_ADMIN_PASSWORD?.trim();
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || "Platform Admin";

  if (!email || !password) {
    console.error(
      "❌ Error: PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD must be provided to seed a super user.",
    );
    console.error(
      'Usage: PLATFORM_ADMIN_EMAIL="admin@domain.com" PLATFORM_ADMIN_PASSWORD="your-password" node src/scripts/seedSuperUser.js',
    );
    process.exit(1);
  }

  const existingByEmail = await findPlatformUserRowByEmail(email);
  if (existingByEmail) {
    await updatePlatformUserRow(existingByEmail.id, {
      name,
      passwordHash: await hashPassword(password),
      sessionVersion: existingByEmail.sessionVersion + 1,
    });
    console.log(`✅ Refreshed credentials for platform super-user ${email}.`);
  } else {
    // Check if a super_user already exists under a different email
    const pool = (await import("../db/database.js")).getPool();
    const existingSuper = await pool.query(
      "SELECT id, session_version FROM platform_users WHERE role = $1 LIMIT 1",
      ["super_user"],
    );
    if (existingSuper.rows.length > 0) {
      const superId = existingSuper.rows[0].id;
      const currentVersion = Number(existingSuper.rows[0].session_version || 0);
      await updatePlatformUserRow(superId, {
        email: email.toLowerCase(),
        name,
        passwordHash: await hashPassword(password),
        sessionVersion: currentVersion + 1,
      });
      console.log(`✅ Updated existing super-user record to ${email}.`);
    } else {
      await insertPlatformUser({
        id: randomBytes(8).toString("hex"),
        email: email.toLowerCase(),
        name,
        passwordHash: await hashPassword(password),
        role: "super_user",
        permissions: FULL_PLATFORM_ADMIN_PERMISSIONS,
        sessionVersion: 0,
        createdAt: new Date().toISOString(),
      });
      console.log(`✅ Platform super-user seeded successfully for ${email}`);
    }
  }
  const { syncPlatformSuperUserToTenants } =
    await import("../services/platform/platformSuperUserTenantSyncService.js");
  const syncedCount = await syncPlatformSuperUserToTenants();
  console.log(`✅ Synchronized platform super-user to ${syncedCount} tenant workspace(s).`);
  await closeDatabase();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Failed to seed platform super-user:", err);
  process.exit(1);
});

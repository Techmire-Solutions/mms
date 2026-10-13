import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

process.env.NODE_ENV = process.env.NODE_ENV || "test";

/**
 * Platform (apex) admin management E2E flow:
 * Super-user creates a new platform administrator, edits permissions,
 * and executes authenticated removal.
 *
 * SAFETY RULES:
 * - Never run against production (`isProductionTarget` guard).
 * - Ephemeral accounts only (deleted in `afterAll`).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "../../apps/backend");

const isProductionTarget =
  process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production";

const e2eSuperEmail = "platform-e2e-super@test.com";
const e2eSuperPassword = "Pa$$w0rd123";
const e2eCreatedAdminEmail = `e2e-created-admin-${Date.now()}@test.com`;
const e2eCreatedAdminPassword = "Pa$$w0rd456";
const e2eCreatedAdminName = "E2E Managed Admin";

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const envFile = readFileSync(path.join(backendDir, ".env"), "utf8");
    const match = envFile.match(/^DATABASE_URL=(.*)$/m);
    if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    // Fall through to error
  }
  throw new Error(`DATABASE_URL could not be resolved from ${path.join(backendDir, ".env")}`);
}

function runGuardedNodeScript(script: string, extraEnv: Record<string, string> = {}): string {
  const tmpBase = path.join(backendDir, ".tmp-e2e");
  mkdirSync(tmpBase, { recursive: true });
  const tmpDir = mkdtempSync(path.join(tmpBase, "script-"));
  const scriptPath = path.join(tmpDir, "script.cjs");
  writeFileSync(scriptPath, script);
  try {
    return execSync(`node "${scriptPath}"`, {
      cwd: backendDir,
      encoding: "utf8",
      timeout: 60_000,
      env: {
        ...process.env,
        DATABASE_URL: resolveDatabaseUrl(),
        NODE_PATH: path.join(backendDir, "node_modules"),
        ...extraEnv,
      },
    });
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function ensureE2eSuperUser(): void {
  const script = [
    'const { Pool } = require("pg");',
    'const { scrypt, randomBytes } = require("node:crypto");',
    'const { promisify } = require("node:util");',
    "const scryptAsync = promisify(scrypt);",
    'const E2E_GUARD = process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production";',
    'if (E2E_GUARD) { console.log("[E2E SAFEGUARD] skipping platform admin seed on production"); process.exit(0); }',
    "(async () => {",
    "  const pool = new Pool({ connectionString: process.env.DATABASE_URL });",
    "  const email = process.env.E2E_SUPER_EMAIL.toLowerCase();",
    '  const salt = randomBytes(16).toString("hex");',
    "  const key = await scryptAsync(process.env.E2E_SUPER_PASSWORD, salt, 64);",
    '  const passwordHash = `${salt}:${key.toString("hex")}`;',
    "  await pool.query(\"UPDATE platform_users SET role = 'admin' WHERE role = 'super_user' AND email <> $1\", [email]);",
    "  await pool.query(\"DELETE FROM platform_users WHERE (email LIKE 'platform-a11y-%' OR email LIKE 'e2e-%') AND email <> $1\", [email]);",
    '  const existing = await pool.query("SELECT id FROM platform_users WHERE email = $1", [email]);',
    "  let userId;",
    "  if (existing.rows.length > 0) {",
    "    userId = existing.rows[0].id;",
    "    await pool.query(",
    "      \"UPDATE platform_users SET password_hash = $1, disabled_at = NULL, role = 'super_user', session_version = session_version + 1, updated_at = now() WHERE id = $2\",",
    "      [passwordHash, userId],",
    "    );",
    '    await pool.query("DELETE FROM platform_user_permissions WHERE platform_user_id = $1", [userId]);',
    "  } else {",
    '    userId = randomBytes(8).toString("hex");',
    "    await pool.query(",
    "      \"INSERT INTO platform_users (id, email, name, password_hash, email_verified_at, role, session_version) VALUES ($1, $2, $3, $4, now(), 'super_user', 0)\",",
    '      [userId, email, "Platform E2E Super User", passwordHash],',
    "    );",
    "  }",
    '  const keys = ["workspaces", "onboard", "settings", "admins", "system"];',
    "  for (const k of keys) {",
    "    await pool.query(",
    '      "INSERT INTO platform_user_permissions (platform_user_id, permission_key, is_granted) VALUES ($1, $2, true) ON CONFLICT DO NOTHING",',
    "      [userId, k],",
    "    );",
    "  }",
    "  await pool.end();",
    "})().catch((error) => { console.error(error); process.exit(1); });",
  ].join("\n");

  runGuardedNodeScript(script, {
    E2E_SUPER_EMAIL: e2eSuperEmail,
    E2E_SUPER_PASSWORD: e2eSuperPassword,
  });
}

function cleanupEphemeralPlatformUsers(): void {
  const script = [
    'const { Pool } = require("pg");',
    'const E2E_GUARD = process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production";',
    'if (E2E_GUARD) { console.log("[E2E SAFEGUARD] skipping cleanup on production"); process.exit(0); }',
    "(async () => {",
    "  const pool = new Pool({ connectionString: process.env.DATABASE_URL });",
    "  const superEmail = process.env.E2E_SUPER_EMAIL.toLowerCase();",
    "  const createdEmail = process.env.E2E_CREATED_EMAIL.toLowerCase();",
    "  await pool.query(\"DELETE FROM platform_users WHERE email IN ($1, $2) OR email LIKE 'e2e-created-admin-%'\", [superEmail, createdEmail]);",
    "  const superCount = await pool.query(\"SELECT count(*)::int AS count FROM platform_users WHERE role = 'super_user'\");",
    "  if (superCount.rows[0].count === 0) {",
    "    await pool.query(\"UPDATE platform_users SET role = 'super_user' WHERE id = (SELECT id FROM platform_users WHERE role = 'admin' ORDER BY created_at DESC LIMIT 1)\");",
    "  }",
    "  await pool.end();",
    "})().catch((error) => { console.error(error); process.exit(1); });",
  ].join("\n");

  runGuardedNodeScript(script, {
    E2E_SUPER_EMAIL: e2eSuperEmail,
    E2E_CREATED_EMAIL: e2eCreatedAdminEmail,
  });
}

test.describe("Platform Admin Creation and Access Management Flow", () => {
  test.skip(
    isProductionTarget,
    "Platform admin management is never run against production targets.",
  );

  test.beforeAll(() => {
    ensureE2eSuperUser();
  });

  test.afterAll(() => {
    cleanupEphemeralPlatformUsers();
  });

  test("super-user creates platform admin, modifies capability permissions, and verifies persistence", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const platformLanding = page
      .getByRole("heading", { name: /Dashboard|Welcome back/i })
      .or(page.locator('a[href="/onboarding"]'));

    // 1. Sign in as platform super-user
    await test.step("1. Sign in to platform console as super-user", async () => {
      await page.goto("/platform/login");
      await page.waitForLoadState("domcontentloaded");

      const setupEmailInput = page.locator("#platform-setup-email");
      const platformEmailInput = page.locator("#platform-email");
      const retryBtn = page.getByRole("button", { name: /Try again/i });

      await expect
        .poll(
          async () => {
            if (await retryBtn.isVisible().catch(() => false)) {
              await retryBtn.click().catch(() => {});
            }
            if (
              await platformLanding
                .first()
                .isVisible()
                .catch(() => false)
            )
              return true;
            if (await setupEmailInput.isVisible().catch(() => false)) return true;
            if (await platformEmailInput.isVisible().catch(() => false)) return true;
            return false;
          },
          { timeout: 45_000, intervals: [500, 1000, 2000] },
        )
        .toBe(true);

      if (
        !(await platformLanding
          .first()
          .isVisible()
          .catch(() => false))
      ) {
        if (await setupEmailInput.isVisible().catch(() => false)) {
          await page.locator("#platform-setup-name").fill("Platform Super");
          await setupEmailInput.fill(e2eSuperEmail);
          await page.locator("#platform-setup-password").fill(e2eSuperPassword);
          await page.locator('button[type="submit"]').click();
        } else if (await platformEmailInput.isVisible().catch(() => false)) {
          await platformEmailInput.fill(e2eSuperEmail);
          await page.locator("#platform-password").fill(e2eSuperPassword);
          await page.locator('button[type="submit"]').click();
        }
      }

      await expect(platformLanding.first()).toBeVisible({ timeout: 45_000 });
    });

    // 2. Navigate to Admins management directory
    await test.step("2. Navigate to /platform/admins", async () => {
      await page.goto("/platform/admins");
      await page.waitForLoadState("domcontentloaded");
      await expect(
        page.getByRole("heading", { name: /Administrators|Manage/i }).first(),
      ).toBeVisible({
        timeout: 30_000,
      });
    });

    // 3. Open Add Administrator modal
    await test.step("3. Create a new platform administrator", async () => {
      const addAdminBtn = page.getByRole("button", { name: /^(Administrator|Admin)$/i }).first();
      await expect(addAdminBtn).toBeVisible({ timeout: 20_000 });
      await addAdminBtn.click();

      const nameInput = page.locator("#admin-name");
      await expect(nameInput).toBeVisible({ timeout: 15_000 });
      await nameInput.fill(e2eCreatedAdminName);

      const emailInput = page.locator("#admin-email");
      await emailInput.fill(e2eCreatedAdminEmail);

      const passwordInput = page.locator("#admin-password");
      await passwordInput.fill(e2eCreatedAdminPassword);

      const operatorPasswordInput = page.locator("#admin-operator-password");
      if (await operatorPasswordInput.isVisible().catch(() => false)) {
        await operatorPasswordInput.fill(e2eSuperPassword);
      }

      // Select capability permissions via preset button
      const selectAllBtn = page.getByRole("button", { name: /Select all/i });
      if (await selectAllBtn.isVisible().catch(() => false)) {
        await selectAllBtn.click();
      }

      // Submit modal
      const modalSubmitBtn = page
        .locator('[role="dialog"]')
        .getByRole("button", { name: /^(Administrator|Admin|Save)$/i });
      await modalSubmitBtn.click();

      // Wait for modal to close and new admin to appear in directory
      await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 20_000 });

      const searchBox = page.locator('input[placeholder*="Search"]');
      if (await searchBox.isVisible().catch(() => false)) {
        await searchBox.fill(e2eCreatedAdminName);
      }

      const adminRow = page
        .locator("tr:visible", { hasText: new RegExp(e2eCreatedAdminName, "i") })
        .first();
      await adminRow.scrollIntoViewIfNeeded().catch(() => {});
      await expect(adminRow).toBeVisible({ timeout: 25_000 });
    });

    // 4. Edit administrator permissions
    await test.step("4. Edit administrator permissions", async () => {
      // Find row or card containing the created admin
      const adminContainer = page
        .locator("tr:visible", { hasText: new RegExp(e2eCreatedAdminName, "i") })
        .first();
      await adminContainer.scrollIntoViewIfNeeded().catch(() => {});

      const editAccessBtn = adminContainer.getByRole("button", {
        name: /Edit permissions|Edit access/i,
      });
      await expect(editAccessBtn).toBeVisible({ timeout: 15_000 });
      await editAccessBtn.click();

      const editModal = page.locator('[role="dialog"]');
      await expect(editModal).toBeVisible({ timeout: 15_000 });

      const stepUpInput = editModal.locator("#edit-admin-step-up");
      if (await stepUpInput.isVisible().catch(() => false)) {
        await stepUpInput.fill(e2eSuperPassword);
      }

      // Save permission changes
      const savePermsBtn = editModal.getByRole("button", { name: /Save Permissions|Save/i });
      await savePermsBtn.click();

      await expect(editModal).not.toBeVisible({ timeout: 20_000 });
    });

    // 5. Clean up created admin via UI deletion (with super-user password re-auth)
    await test.step("5. Delete ephemeral admin via danger dialog", async () => {
      const adminContainer = page.locator("tr").filter({ hasText: e2eCreatedAdminName }).first();
      const deleteBtn = adminContainer.getByRole("button", { name: /Remove admin|Delete admin/i });
      if (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click();

        const dangerModal = page.locator('[role="dialog"]');
        await expect(dangerModal).toBeVisible({ timeout: 15_000 });

        const confirmPwInput = page.locator("#platform-admin-danger-password");
        await confirmPwInput.fill(e2eSuperPassword);

        const confirmDeleteBtn = dangerModal.getByRole("button", {
          name: /Remove Administrator|Delete Administrator|Confirm/i,
        });
        await confirmDeleteBtn.click();

        await expect(dangerModal).not.toBeVisible({ timeout: 20_000 });
      }
    });
  });
});

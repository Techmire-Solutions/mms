import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "../../apps/backend");

export const E2E_PLATFORM_PERMISSIONS = [
  "workspaces",
  "onboard",
  "settings",
  "admins",
  "system",
] as const;

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

function runGuardedScript(script: string, extraEnv: Record<string, string> = {}): string {
  const tmpBase = path.join(backendDir, ".tmp-e2e");
  mkdirSync(tmpBase, { recursive: true });
  const tmpDir = mkdtempSync(path.join(tmpBase, "admin-seeder-"));
  const scriptPath = path.join(tmpDir, "seed.cjs");
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

/**
 * Ensures an E2E platform admin user exists with the specified credentials
 * and granted permissions WITHOUT wiping other platform users.
 */
export function ensureE2ePlatformAdmin(email: string, password: string): void {
  if (process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    return;
  }

  const script = [
    'const { Pool } = require("pg");',
    'const { scrypt, randomBytes } = require("node:crypto");',
    'const { promisify } = require("node:util");',
    "const scryptAsync = promisify(scrypt);",
    "(async () => {",
    "  const pool = new Pool({ connectionString: process.env.DATABASE_URL });",
    "  const email = process.env.E2E_SEED_EMAIL.toLowerCase();",
    '  const salt = randomBytes(16).toString("hex");',
    "  const key = await scryptAsync(process.env.E2E_SEED_PASSWORD, salt, 64);",
    '  const passwordHash = `${salt}:${key.toString("hex")}`;',
    '  const existing = await pool.query("SELECT id FROM platform_users WHERE email = $1", [email]);',
    "  let userId;",
    "  if (existing.rows.length > 0) {",
    "    userId = existing.rows[0].id;",
    "    await pool.query(",
    '      "UPDATE platform_users SET password_hash = $1, disabled_at = NULL, session_version = session_version + 1, updated_at = now() WHERE id = $2",',
    "      [passwordHash, userId],",
    "    );",
    "  } else {",
    '    userId = randomBytes(8).toString("hex");',
    "    await pool.query(",
    "      \"INSERT INTO platform_users (id, email, name, password_hash, email_verified_at, role, session_version) VALUES ($1, $2, $3, $4, now(), 'admin', 0)\",",
    '      [userId, email, "Platform E2E Admin", passwordHash],',
    "    );",
    "  }",
    "  const permissions = JSON.parse(process.env.E2E_SEED_PERMISSIONS);",
    "  for (const perm of permissions) {",
    "    await pool.query(",
    '      "INSERT INTO platform_user_permissions (platform_user_id, permission_key, is_granted) VALUES ($1, $2, true) ON CONFLICT DO NOTHING",',
    "      [userId, perm],",
    "    );",
    "  }",
    "  await pool.end();",
    "})().catch((err) => { console.error(err); process.exit(1); });",
  ].join("\n");

  runGuardedScript(script, {
    E2E_SEED_EMAIL: email,
    E2E_SEED_PASSWORD: password,
    E2E_SEED_PERMISSIONS: JSON.stringify(E2E_PLATFORM_PERMISSIONS),
  });
}

/**
 * Sets the password and enables must_change_password for a tenant admin user.
 * Used during E2E bootstrapping when workspace is provisioned via the UI wizard
 * (which sends activation emails instead of accepting admin passwords directly).
 */
export function setTenantAdminPassword(
  tenantSubdomain: string,
  email: string,
  password: string,
): void {
  if (process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    return;
  }

  const script = [
    'const { Pool } = require("pg");',
    'const { scrypt, randomBytes } = require("node:crypto");',
    'const { promisify } = require("node:util");',
    "const scryptAsync = promisify(scrypt);",
    "(async () => {",
    "  const pool = new Pool({ connectionString: process.env.DATABASE_URL });",
    '  const salt = randomBytes(16).toString("hex");',
    "  const key = await scryptAsync(process.env.ADMIN_PASSWORD, salt, 64);",
    '  const passwordHash = `${salt}:${key.toString("hex")}`;',
    "  await pool.query(",
    '    "UPDATE tenant_users SET password_hash = $1, must_change_password = true, updated_at = now() WHERE workspace_subdomain = $2 AND login_email = $3",',
    "    [passwordHash, process.env.TENANT_SUBDOMAIN, process.env.ADMIN_EMAIL],",
    "  );",
    "  await pool.end();",
    "})().catch((error) => { console.error(error); process.exit(1); });",
  ].join("\n");

  runGuardedScript(script, {
    TENANT_SUBDOMAIN: tenantSubdomain.toLowerCase(),
    ADMIN_EMAIL: email.toLowerCase(),
    ADMIN_PASSWORD: password,
  });
}

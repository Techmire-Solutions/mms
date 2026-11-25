import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "../../apps/api");

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
  throw new Error(
    `DATABASE_URL could not be resolved from ${path.join(backendDir, ".env")}; ` +
      "set it to the database the backend is using (these specs need an isolated disposable database)",
  );
}

/**
 * Sanitized `host:port/db` for the database the seeder will write to. The seeder
 * falls back to `apps/api/.env` when `DATABASE_URL` is unset, so a backend
 * started against another database (e.g. a disposable one) silently diverges and
 * every login fails with "Invalid platform credentials". Printing the target makes
 * that mismatch obvious in the Playwright output.
 */
function databaseTargetLabel(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "<unparsable DATABASE_URL>";
  }
}

function runGuardedScript(script: string, extraEnv: Record<string, string> = {}): string {
  const tmpBase = path.join(backendDir, ".tmp-e2e");
  mkdirSync(tmpBase, { recursive: true });
  const tmpDir = mkdtempSync(path.join(tmpBase, "admin-seeder-"));
  const scriptPath = path.join(tmpDir, "seed.cjs");
  writeFileSync(scriptPath, script);
  const databaseUrl = resolveDatabaseUrl();
  console.log(
    `[e2e] seeding into ${databaseTargetLabel(databaseUrl)} — export DATABASE_URL so it matches the backend's database`,
  );
  try {
    return execFileSync(process.execPath, [scriptPath], {
      cwd: backendDir,
      encoding: "utf8",
      timeout: 60_000,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
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

export interface TenantProvisioningExpectations {
  subdomain: string;
  madrasaName: string;
  adminName: string;
  adminEmail: string;
  adminGender: "male" | "female";
}

/**
 * Asserts the platform-console provisioning contract for a freshly created madrasa:
 *
 * 1. The provisioned admin is the tenant's ONLY active `super_admin`.
 * 2. That admin is linked to an active first contact carrying name + gender.
 * 3. No platform user is mirrored into the tenant under any role.
 * 4. The console database (`workspaces`) stores the collected madrasa name and the
 *    provisioned admin's name/email/gender.
 *
 * Throws (Playwright failure) with every violated rule listed.
 */
export function assertTenantProvisioningInvariants(
  expectations: TenantProvisioningExpectations,
): void {
  if (process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    return;
  }

  const script = [
    'const { Pool } = require("pg");',
    "(async () => {",
    "  const pool = new Pool({ connectionString: process.env.DATABASE_URL });",
    "  const subdomain = process.env.TENANT_SUBDOMAIN;",
    "  const expectedName = process.env.EXPECTED_MADRASA_NAME;",
    "  const adminEmail = process.env.ADMIN_EMAIL;",
    "  const adminName = process.env.ADMIN_NAME;",
    "  const adminGender = process.env.ADMIN_GENDER;",
    "  const violations = [];",
    "  const users = (",
    "    await pool.query(",
    '      "SELECT id, login_email, role, contact_id FROM tenant_users WHERE workspace_subdomain = $1 AND deleted_at IS NULL",',
    "      [subdomain],",
    "    )",
    "  ).rows;",
    "  const superAdmins = users.filter((user) => user.role === 'super_admin');",
    "  if (superAdmins.length !== 1) {",
    "    violations.push(`expected exactly 1 active super_admin, found ${superAdmins.length}`);",
    "  }",
    "  const admin = superAdmins[0];",
    "  if (admin && String(admin.login_email).toLowerCase() !== adminEmail) {",
    "    violations.push(`super_admin is ${admin.login_email}, expected ${adminEmail}`);",
    "  }",
    "  if (admin && !admin.contact_id) {",
    "    violations.push('provisioned super_admin has no linked first contact');",
    "  }",
    "  if (admin && admin.contact_id) {",
    "    const contact = (",
    "      await pool.query(",
    '        "SELECT id, name, gender FROM contacts WHERE workspace_subdomain = $1 AND id = $2 AND deleted_at IS NULL",',
    "        [subdomain, admin.contact_id],",
    "      )",
    "    ).rows[0];",
    "    if (!contact) violations.push('linked first contact row is missing or deleted');",
    "    else {",
    "      if (!String(contact.name || '').trim()) violations.push('linked first contact has no name');",
    "      if (contact.gender !== adminGender) {",
    "        violations.push(`contact gender is ${contact.gender}, expected ${adminGender}`);",
    "      }",
    "    }",
    "  }",
    "  const consoleRow = (",
    "    await pool.query(",
    '      "SELECT madrasa_name, admin_name, admin_email, admin_gender FROM workspaces WHERE subdomain = $1",',
    "      [subdomain],",
    "    )",
    "  ).rows[0];",
    "  if (!consoleRow) violations.push('workspace registry row is missing from the console database');",
    "  else {",
    "    if (consoleRow.madrasa_name !== expectedName) {",
    "      violations.push(`console madrasa_name is ${consoleRow.madrasa_name}, expected ${expectedName}`);",
    "    }",
    "    if (consoleRow.admin_name !== adminName) {",
    "      violations.push(`console admin_name is ${consoleRow.admin_name}, expected ${adminName}`);",
    "    }",
    "    if (String(consoleRow.admin_email || '').toLowerCase() !== adminEmail) {",
    "      violations.push(`console admin_email is ${consoleRow.admin_email}, expected ${adminEmail}`);",
    "    }",
    "    if (consoleRow.admin_gender !== adminGender) {",
    "      violations.push(`console admin_gender is ${consoleRow.admin_gender}, expected ${adminGender}`);",
    "    }",
    "  }",
    "  const mirrored = (",
    "    await pool.query(",
    '      "SELECT count(*)::int AS count FROM tenant_users t JOIN platform_users p ON lower(p.email) = lower(t.login_email) WHERE t.workspace_subdomain = $1",',
    "      [subdomain],",
    "    )",
    "  ).rows[0].count;",
    "  if (mirrored > 0) violations.push(`tenant contains ${mirrored} platform user row(s)`);",
    "  await pool.end();",
    "  if (violations.length > 0) {",
    '    console.error("[e2e] tenant provisioning invariant violated:\\n - " + violations.join("\\n - "));',
    "    process.exit(1);",
    "  }",
    '  console.log("[e2e] tenant provisioning invariants verified for " + subdomain);',
    "})().catch((error) => { console.error(error); process.exit(1); });",
  ].join("\n");

  runGuardedScript(script, {
    TENANT_SUBDOMAIN: expectations.subdomain.toLowerCase(),
    EXPECTED_MADRASA_NAME: expectations.madrasaName,
    ADMIN_NAME: expectations.adminName,
    ADMIN_EMAIL: expectations.adminEmail.toLowerCase(),
    ADMIN_GENDER: expectations.adminGender,
  });
}

/**
 * Asserts the platform-owned madrasa name in the console database — used after a
 * platform rename and after attempting a tenant-side rename.
 */
export function assertWorkspaceMadrasaName(tenantSubdomain: string, expectedName: string): void {
  if (process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    return;
  }

  const script = [
    'const { Pool } = require("pg");',
    "(async () => {",
    "  const pool = new Pool({ connectionString: process.env.DATABASE_URL });",
    "  const row = (",
    "    await pool.query(",
    '      "SELECT madrasa_name FROM workspaces WHERE subdomain = $1",',
    "      [process.env.TENANT_SUBDOMAIN],",
    "    )",
    "  ).rows[0];",
    "  await pool.end();",
    "  const actual = row ? row.madrasa_name : undefined;",
    "  if (actual !== process.env.EXPECTED_MADRASA_NAME) {",
    '    console.error("[e2e] madrasa name mismatch: " + actual + " !== " + process.env.EXPECTED_MADRASA_NAME);',
    "    process.exit(1);",
    "  }",
    '  console.log("[e2e] madrasa name verified: " + actual);',
    "})().catch((error) => { console.error(error); process.exit(1); });",
  ].join("\n");

  runGuardedScript(script, {
    TENANT_SUBDOMAIN: tenantSubdomain.toLowerCase(),
    EXPECTED_MADRASA_NAME: expectedName,
  });
}

export interface BrandingIdentityExpectations {
  email?: string;
  phone?: string;
  tagline?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Asserts the institution identity fields reached PostgreSQL (workspaces typed
 * columns). Settings → Institution saves are server-authoritative; this proves the
 * values survive the write instead of only living in the browser store.
 */
export function assertBrandingIdentity(
  tenantSubdomain: string,
  expected: BrandingIdentityExpectations,
): void {
  if (process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    return;
  }

  const script = [
    'const { Pool } = require("pg");',
    "(async () => {",
    "  const pool = new Pool({ connectionString: process.env.DATABASE_URL });",
    "  const expected = JSON.parse(process.env.EXPECTED_BRANDING);",
    "  const row = (",
    "    await pool.query(",
    '      "SELECT email, phone, tagline, address_line1, city, postal_code, country FROM workspaces WHERE subdomain = $1",',
    "      [process.env.TENANT_SUBDOMAIN],",
    "    )",
    "  ).rows[0];",
    "  await pool.end();",
    "  const violations = [];",
    "  if (!row) violations.push('workspace row missing');",
    "  else {",
    "    if (expected.email && row.email !== expected.email) violations.push(`email ${row.email} !== ${expected.email}`);",
    "    if (expected.phone && row.phone !== expected.phone) violations.push(`phone ${row.phone} !== ${expected.phone}`);",
    "    if (expected.tagline && row.tagline !== expected.tagline) violations.push(`tagline ${row.tagline} !== ${expected.tagline}`);",
    "    if (expected.addressLine1 && row.address_line1 !== expected.addressLine1) violations.push(`addressLine1 ${row.address_line1} !== ${expected.addressLine1}`);",
    "    if (expected.city && row.city !== expected.city) violations.push(`city ${row.city} !== ${expected.city}`);",
    "    if (expected.postalCode && row.postal_code !== expected.postalCode) violations.push(`postalCode ${row.postal_code} !== ${expected.postalCode}`);",
    "    if (expected.country && row.country !== expected.country) violations.push(`country ${row.country} !== ${expected.country}`);",
    "  }",
    "  if (violations.length > 0) {",
    '    console.error("[e2e] institution branding not persisted: " + violations.join("; "));',
    "    process.exit(1);",
    "  }",
    '  console.log("[e2e] institution branding persisted for " + process.env.TENANT_SUBDOMAIN);',
    "})().catch((error) => { console.error(error); process.exit(1); });",
  ].join("\n");

  runGuardedScript(script, {
    TENANT_SUBDOMAIN: tenantSubdomain.toLowerCase(),
    EXPECTED_BRANDING: JSON.stringify(expected),
  });
}

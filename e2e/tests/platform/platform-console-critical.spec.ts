import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, type Response, test } from "@playwright/test";
import { waitForToastOverlayToClear } from "../../helpers/tenantOperations.js";

process.env.NODE_ENV = process.env.NODE_ENV || "test";

/**
 * Platform (apex) console critical lifecycle — workspace disable / re-enable.
 *
 * DESTRUCTIVE-SAFETY RULES (read before editing):
 * - This spec is intentionally NOT tagged `@smoke`. The production e2e target
 *   runs only `--grep @smoke`, so this spec can never run against production.
 * - It never calls resetPlatformUsers() (that would wipe real platform users).
 *   Instead it seeds its own throwaway platform admin row (role `admin`, exact
 *   ephemeral email) directly, and removes exactly that row afterwards.
 * - It only ever mutates the ephemeral workspace it creates
 *   (`platform-e2e-<Date.now()>`) and its own admin row. Every disable is
 *   re-enabled in a `finally`, with a DB-level safety net in `afterAll`.
 * - All DB helpers refuse to run when E2E_TARGET/NODE_ENV is `production`.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "../../../apps/backend");

const isProductionTarget =
  process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production";

// Ephemeral tenant — unique per run so re-runs never collide.
const subdomain = `platform-e2e-${Date.now()}`;
const tenantOrigin = `http://${subdomain}.localhost:5173`;
const madrasaName = "Platform E2E Madrasa";

const tenantOwnerEmail = `owner@${subdomain}.com`;
const tenantOwnerTempPassword = "Madrasa@1234";
const tenantOwnerPassword = "Madrasa@5678";

// Dedicated apex admin used only by this spec. Fixed email keeps re-runs
// idempotent (the ensure script refreshes only this exact row); it is never
// an existing dev account, and it is deleted in afterAll.
const e2ePlatformEmail = "platform-e2e-admin@test.com";
const e2ePlatformPassword = "Pa$$w0rd123";
const PLATFORM_ADMIN_PERMISSION_KEYS = ["workspaces", "onboard", "settings", "admins", "system"];

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const envFile = readFileSync(path.join(backendDir, ".env"), "utf8");
    const match = envFile.match(/^DATABASE_URL=(.*)$/m);
    if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    // Fall through to the explicit error below.
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

/**
 * Creates (or refreshes the password of) the e2e platform admin. This NEVER
 * touches any other platform user — unlike resetPlatformUsers() which wipes
 * the whole table. Super-user slots are a singleton in this schema, so the
 * e2e operator is an `admin` with explicit permission grants.
 */
function ensureE2ePlatformAdmin(): void {
  const script = [
    'const { Pool } = require("pg");',
    'const { scrypt, randomBytes } = require("node:crypto");',
    'const { promisify } = require("node:util");',
    "const scryptAsync = promisify(scrypt);",
    'const E2E_GUARD = process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production";',
    'if (E2E_GUARD) { console.log("[E2E SAFEGUARD] skipping platform admin seed on production"); process.exit(0); }',
    "(async () => {",
    "  const pool = new Pool({ connectionString: process.env.DATABASE_URL });",
    "  const email = process.env.E2E_PLATFORM_EMAIL.toLowerCase();",
    '  const salt = randomBytes(16).toString("hex");',
    "  const key = await scryptAsync(process.env.E2E_PLATFORM_PASSWORD, salt, 64);",
    '  const passwordHash = `${salt}:${key.toString("hex")}`;',
    '  const existing = await pool.query("SELECT id FROM platform_users WHERE email = $1", [email]);',
    "  let userId;",
    "  if (existing.rows.length > 0) {",
    "    userId = existing.rows[0].id;",
    "    await pool.query(",
    '      "UPDATE platform_users SET password_hash = $1, disabled_at = NULL, session_version = session_version + 1, updated_at = now() WHERE id = $2",',
    "      [passwordHash, userId],",
    "    );",
    '    await pool.query("DELETE FROM platform_user_permissions WHERE platform_user_id = $1", [userId]);',
    '    console.log("[E2E] refreshed existing platform admin", email);',
    "  } else {",
    '    userId = randomBytes(8).toString("hex");',
    "    await pool.query(",
    "      \"INSERT INTO platform_users (id, email, name, password_hash, email_verified_at, role, session_version) VALUES ($1, $2, $3, $4, now(), 'admin', 0)\",",
    '      [userId, email, "Platform E2E Admin", passwordHash],',
    "    );",
    '    console.log("[E2E] created platform admin", email);',
    "  }",
    "  const keys = JSON.parse(process.env.E2E_PLATFORM_PERMISSIONS);",
    "  for (const key of keys) {",
    "    await pool.query(",
    '      "INSERT INTO platform_user_permissions (platform_user_id, permission_key, is_granted) VALUES ($1, $2, true) ON CONFLICT DO NOTHING",',
    "      [userId, key],",
    "    );",
    "  }",
    "  await pool.end();",
    "})().catch((error) => { console.error(error); process.exit(1); });",
  ].join("\n");

  const output = runGuardedNodeScript(script, {
    E2E_PLATFORM_EMAIL: e2ePlatformEmail,
    E2E_PLATFORM_PASSWORD: e2ePlatformPassword,
    E2E_PLATFORM_PERMISSIONS: JSON.stringify(PLATFORM_ADMIN_PERMISSION_KEYS),
  });
  console.log(output.trim());
}

/**
 * Safety net for the local DB: re-enables the e2e workspace (targeted by its
 * ephemeral subdomain) and removes the e2e platform admin (exact email only).
 * Never runs on a production target; every statement only matches e2e rows.
 */
function cleanupEphemeralPlatformData(): void {
  const script = [
    'const { Pool } = require("pg");',
    'const E2E_GUARD = process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production";',
    'if (E2E_GUARD) { console.log("[E2E SAFEGUARD] skipping cleanup on production"); process.exit(0); }',
    "(async () => {",
    "  const pool = new Pool({ connectionString: process.env.DATABASE_URL });",
    "  const email = process.env.E2E_PLATFORM_EMAIL.toLowerCase();",
    '  const admin = await pool.query("DELETE FROM platform_users WHERE email = $1", [email]);',
    "  console.log(`[E2E] removed e2e platform admin rows: ${admin.rowCount}`);",
    "  if (process.env.E2E_WORKSPACE_SUBDOMAIN) {",
    '    const workspace = await pool.query("UPDATE workspaces SET enabled = TRUE WHERE subdomain = $1 AND enabled = FALSE", [process.env.E2E_WORKSPACE_SUBDOMAIN]);',
    "    console.log(`[E2E] re-enabled e2e workspace (safety net): ${workspace.rowCount}`);",
    "  }",
    "  await pool.end();",
    "})().catch((error) => { console.error(error); process.exit(1); });",
  ].join("\n");

  const output = runGuardedNodeScript(script, {
    E2E_PLATFORM_EMAIL: e2ePlatformEmail,
    E2E_WORKSPACE_SUBDOMAIN: subdomain,
  });
  console.log(output.trim());
}

test.describe("Platform Console Critical Workspace Lifecycle", () => {
  // CI-only spec: production targets run only @smoke specs, and this spec is
  // explicitly skipped for production-like environments as a second guard.
  test.skip(
    isProductionTarget,
    "Platform workspace lifecycle is never run against production targets.",
  );

  test.beforeAll(() => {
    ensureE2ePlatformAdmin();
  });

  test.afterAll(() => {
    // Safety net: leave the local DB exactly as we found it (workspace enabled,
    // no leftover e2e platform admin account).
    cleanupEphemeralPlatformData();
  });

  test("platform admin disables a workspace, tenant shows WorkspaceDisabledScreen, re-enable restores access", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    const platformLanding = page
      .getByRole("heading", { name: /Dashboard|Welcome back/i })
      .or(page.locator('a[href="/onboarding"]'));

    // ------------------------------------------------------------------
    // 1. Platform admin signs into the apex console.
    // ------------------------------------------------------------------
    await test.step("1. Platform admin signs in to apex console", async () => {
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
        await platformLanding
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        return;
      }

      if (await setupEmailInput.isVisible().catch(() => false)) {
        await page.locator("#platform-setup-name").fill("Platform Admin");
        await setupEmailInput.fill(e2ePlatformEmail);
        await page.locator("#platform-setup-password").fill(e2ePlatformPassword);
        await page.locator('button[type="submit"]').click();
      } else if (await platformEmailInput.isVisible().catch(() => false)) {
        await platformEmailInput.fill(e2ePlatformEmail);
        await page.locator("#platform-password").fill(e2ePlatformPassword);
        await page.locator('button[type="submit"]').click();
      }

      await expect(platformLanding.first()).toBeVisible({ timeout: 45_000 });
    });

    // ------------------------------------------------------------------
    // 2. Bootstrap an ephemeral workspace via the onboarding wizard.
    // ------------------------------------------------------------------
    await test.step("2. Bootstrap ephemeral workspace via onboarding wizard", async () => {
      await page.locator('a[href="/onboarding"]:visible').first().click();
      await page.waitForURL("**/onboarding");
      await expect(page.locator("#wizard-step-title")).toBeVisible({ timeout: 30_000 });

      await page.locator("#onboarding-name").fill(madrasaName);
      await page.locator("#onboarding-subdomain").fill(subdomain);
      await expect(page.locator("text=Your URL:")).toBeVisible();

      // Step 2 Modules
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.locator("#wizard-step-title")).toContainText(/Modules/i);

      // Step 3 Structure (keep recommended)
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.locator("#wizard-step-title")).toContainText(
        /Organization structure|structure/i,
      );

      // Step 4 Admin
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.locator("#firstName")).toBeVisible({ timeout: 30_000 });

      await page.locator("#firstName").fill("Platform");
      await page.locator("#lastName").fill("E2E");
      await page.locator("#email").fill(tenantOwnerEmail);
      await page.locator("#password").fill(tenantOwnerTempPassword);
      await page.locator("#confirmPassword").fill(tenantOwnerTempPassword);
      await page.locator("#terms").check();

      // Step 5 Review + create
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.locator("#wizard-step-title")).toContainText(/Review|create/i);
      const platformPasswordInput = page.locator("#onboarding-platform-password");
      if (await platformPasswordInput.isVisible().catch(() => false)) {
        await platformPasswordInput.fill(e2ePlatformPassword);
      }
      await page.getByRole("button", { name: "Create workspace" }).click();
      await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 45_000 });
      await expect(platformLanding.first()).toBeVisible({ timeout: 30_000 });
    });

    // ------------------------------------------------------------------
    // 3. Prove the workspace is active: tenant owner can sign in.
    // ------------------------------------------------------------------
    await test.step("3. Tenant owner signs in and completes mandatory password change", async () => {
      await page.goto(`${tenantOrigin}/login`);
      await page.waitForLoadState("domcontentloaded");
      await page.locator('input[name="email"]').fill(tenantOwnerEmail);
      await page.locator('input[name="password"]').fill(tenantOwnerTempPassword);
      await page.locator('button[type="submit"]').click();

      await page.waitForURL(`${tenantOrigin}/force-password-change`);
      await expect(page.locator("h1")).toContainText(/temporary password|Change your/i, {
        timeout: 20_000,
      });
      await page.locator("#current-password").fill(tenantOwnerTempPassword);
      await page.locator("#new-password").fill(tenantOwnerPassword);
      await page.locator("#confirm-password").fill(tenantOwnerPassword);
      await page.locator('button[type="submit"]').click();

      await page.waitForURL(`${tenantOrigin}/login`);
      await page.locator('input[name="email"]').fill(tenantOwnerEmail);
      await page.locator('input[name="password"]').fill(tenantOwnerPassword);
      await page.locator('button[type="submit"]').click();
      await expect(
        page
          .locator("h1")
          .filter({ hasText: /Assalamu Alaikum|Institution Profile|Complete Institution/i })
          .first(),
      ).toBeVisible({ timeout: 30_000 });
    });

    // Re-disable safety: whatever happens below, restore via UI, then the
    // afterAll hook re-enables at the DB level as a net for hard failures.
    try {
      // ----------------------------------------------------------------
      // 4. Find the workspace row in the apex console (cards view hosts
      //    the enable/disable switch; table rows only show links).
      // ----------------------------------------------------------------
      await test.step("4. Verify workspace is active in apex console cards view", async () => {
        const workspaceToggle = await openWorkspaceCard(page, subdomain);
        await expect(
          page.getByRole("heading", { name: madrasaName, exact: true }).first(),
        ).toBeVisible();
        await expect(workspaceToggle).toBeChecked({ checked: true });
      });

      // ----------------------------------------------------------------
      // 5. Toggle the workspace disabled.
      // ----------------------------------------------------------------
      await test.step("5. Disable workspace from apex console", async () => {
        await toggleWorkspace(page, subdomain, false);
      });

      // ----------------------------------------------------------------
      // 6. Tenant host now serves the WorkspaceDisabledScreen. The workspace
      //    lookup response is captured on the first navigation (armed before
      //    goto, read before any later navigation can discard the body).
      // ----------------------------------------------------------------
      await test.step("6. Verify WorkspaceDisabledScreen and API 403 protection", async () => {
        // Direct API check: workspace is disabled
        const lookupResponse = await page.request.get(
          `${tenantOrigin}/api/workspace/by-subdomain/${subdomain}`,
        );
        expect(lookupResponse.status()).toBe(200);
        const lookupBody = (await lookupResponse.json()) as {
          workspace?: { enabled?: boolean; subdomain?: string };
        };
        expect(lookupBody.workspace?.subdomain).toBe(subdomain);
        expect(lookupBody.workspace?.enabled).toBe(false);

        // UI check: tenant host renders WorkspaceDisabledScreen
        await page.goto(`${tenantOrigin}/login`);
        await expect(
          page.getByRole("heading", { name: /Madrasa Temporarily Unavailable/i }),
        ).toBeVisible({ timeout: 20_000 });
        await expect(page.getByText("Contact Platform Administrator")).toBeVisible();

        // Verify backend authenticateTenant middleware blocks protected tenant traffic with 403
        const apiCheck = await page.request.get(`${tenantOrigin}/api/contacts`);
        expect(apiCheck.status()).toBe(403);
        const errBody = (await apiCheck.json().catch(() => ({}))) as { type?: string };
        expect(errBody.type).toBe("workspace_disabled");
      });
    } finally {
      // ----------------------------------------------------------------
      // 6. Always re-enable via the console so the local DB stays clean.
      // ----------------------------------------------------------------
      await test.step("Re-enable workspace via console UI (safety net)", async () => {
        try {
          await openWorkspaceCard(page, subdomain);
          await toggleWorkspace(page, subdomain, true);
          await waitForToastOverlayToClear(page, "after re-enabling workspace");
        } catch (cleanupErr) {
          console.warn("[E2E] UI workspace re-enable fallback to afterAll DB hook:", cleanupErr);
        }
      });
    }

    // ------------------------------------------------------------------
    // 7. Re-enabled workspace: tenant login works again.
    // ------------------------------------------------------------------
    await test.step("7. Re-enabled workspace allows tenant login and access restoration", async () => {
      await page.context().clearCookies();
      await page.goto(`${tenantOrigin}/login`);
      await page.waitForLoadState("domcontentloaded");
      const tenantEmailInput = page.locator('input[name="email"]');
      await expect(tenantEmailInput).toBeVisible({ timeout: 30_000 });
      await tenantEmailInput.fill(tenantOwnerEmail);
      await page.locator('input[name="password"]').fill(tenantOwnerPassword);
      await page.locator('button[type="submit"]').click();
      await expect(
        page
          .locator("h1")
          .filter({ hasText: /Assalamu Alaikum|Institution Profile|Complete Institution/i })
          .first(),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("main")).not.toContainText("Madrasa Temporarily Unavailable");
    });
  });
});

/**
 * Opens the apex Madrasas directory in cards view and narrows it to the
 * e2e workspace row. Returns the enable/disable switch for that workspace.
 *
 * Selectors (stabilized against `apps/frontend/src/platform/**`):
 * - Cards view toggle: role=group "View Mode" > button "Cards view"
 *   (`WorkViewModeToggle`).
 * - Enable/disable switch: `[id="toggle-${subdomain}"]` — the id is derived
 *   from the workspace subdomain in `WorkspaceRowActions`, so it is unique
 *   per row (the switch only renders in cards view).
 */
async function openWorkspaceCard(page: Page, workspaceSubdomain: string) {
  await page.goto("/platform/workspaces");
  await page.waitForLoadState("domcontentloaded");

  const viewModeGroup = page.getByRole("group", { name: "View Mode" });
  await expect(viewModeGroup).toBeVisible({ timeout: 20_000 });
  await viewModeGroup.getByRole("button", { name: "Cards view" }).click();

  // Force a fresh server fetch so the newly-created workspace is guaranteed to
  // appear (guards against stale TanStack Query cache on first attempt and stale
  // IDB-hydrated cache on retry).
  const refreshBtn = page.getByRole("button", { name: /Refresh/i });
  await expect(refreshBtn).toBeVisible({ timeout: 10_000 });
  await refreshBtn.click();

  const searchInput = page.getByPlaceholder("Search");
  await expect(searchInput).toBeVisible({ timeout: 20_000 });
  await searchInput.fill(workspaceSubdomain);

  // Wait for the workspace card to appear — useDeferredValue settles within
  // one additional render after the search value commits to the URL params.
  const workspaceToggle = page.locator(`[id="toggle-${workspaceSubdomain}"]`);
  await expect(workspaceToggle).toBeVisible({ timeout: 20_000 });
  return workspaceToggle;
}

/**
 * Toggles the workspace and waits for the persisted PATCH response plus the
 * success toast. `checked` is asserted through radix's aria-checked state.
 */
async function toggleWorkspace(
  page: Page,
  workspaceSubdomain: string,
  enabled: boolean,
): Promise<void> {
  const workspaceToggle = page.locator(`[id="toggle-${workspaceSubdomain}"]`);
  const patchResponse: Promise<Response> = page.waitForResponse(
    (resp) =>
      resp.request().method() === "PATCH" &&
      resp.url().includes(`/api/platform/workspaces/${workspaceSubdomain}`),
    { timeout: 20_000 },
  );
  await workspaceToggle.click();
  const response = await patchResponse;
  expect(
    response.status(),
    `PATCH /api/platform/workspaces/${workspaceSubdomain} should persist`,
  ).toBe(200);

  await expect(
    page.getByText(enabled ? "Madrasa enabled successfully" : "Madrasa disabled successfully"),
  ).toBeVisible();
  await expect(workspaceToggle).toBeChecked({ checked: enabled, timeout: 15_000 });
}

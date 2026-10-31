#!/usr/bin/env node
/**
 * Rendered UI/UX review harness.
 *
 * One-off review tooling, deliberately NOT wired into CI. It provisions a synthetic
 * tenant, seeds deterministic demo data, and captures the screenshot/measurement corpus
 * referenced by `docs/ui-ux-review-<date>/README.md`.
 *
 * The corpus directory is derived from `UIUX_REVIEW_RUN` (default `2026-10-30`, the
 * original review). Set it to a new date to keep a later review from overwriting the
 * previous evidence, e.g. `UIUX_REVIEW_RUN=2026-10-31`.
 *
 * Safety:
 *  - refuses to run unless BASE_URL is localhost/127.0.0.1 and E2E_TARGET !== production;
 *  - only writes to `.logs/ui-ux-review-<run>/` and a dedicated `uiuxreview*` tenant;
 *  - never touches an existing tenant's rows (language is changed only on the review tenant).
 *
 * Usage:
 *   UIUX_REVIEW_RUN=2026-10-31 node scripts/capture-ui-ux-review.mjs --provision
 *   UIUX_REVIEW_RUN=2026-10-31 node scripts/capture-ui-ux-review.mjs --capture-core
 *   UIUX_REVIEW_RUN=2026-10-31 node scripts/capture-ui-ux-review.mjs --verify
 */
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const e2eDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(e2eDir, "..");
const backendDir = path.join(repoRoot, "apps/backend");
const REVIEW_RUN = process.env.UIUX_REVIEW_RUN ?? "2026-10-30";
const outDir = path.join(repoRoot, `.logs/ui-ux-review-${REVIEW_RUN}`);
const screensDir = path.join(outDir, "screens");
const statePath = path.join(outDir, "review-tenant.json");

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const PLATFORM_PASSWORD = "Pa$$w0rd123";
const TENANT_TEMP_PASSWORD = "Madrasa@1234";
const TENANT_PASSWORD = "Madrasa@5678";
const MODULES = [
  "dashboard",
  "contacts",
  "messaging",
  "tasks",
  "students",
  "faculty",
  "sessions",
  "attendance",
  "enrollment",
  "hasanat",
  "workshops",
  "examination",
  "questionBank",
  "finance",
  "accounting",
  "obligations",
  "users",
];

function assertLocal() {
  const host = new URL(BASE_URL).hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  if (!local || process.env.E2E_TARGET === "production" || process.env.NODE_ENV === "production") {
    throw new Error(`Refusing to run the review harness against non-local target: ${BASE_URL}`);
  }
}

function ensureDirs() {
  mkdirSync(screensDir, { recursive: true });
}

function readBackendDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = readFileSync(path.join(backendDir, ".env"), "utf8");
  const match = envFile.match(/^DATABASE_URL=(.*)$/m);
  if (!match?.[1]) throw new Error("DATABASE_URL not found in apps/backend/.env");
  return match[1].trim().replace(/^["']|["']$/g, "");
}

/** Run a tiny CommonJS script with `pg` resolved from the backend workspace. */
function runDbScript(source, extraEnv = {}) {
  const tmpBase = path.join(backendDir, ".tmp-e2e");
  mkdirSync(tmpBase, { recursive: true });
  const tmpDir = path.join(tmpBase, `uiux-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const scriptPath = path.join(tmpDir, "run.cjs");
  writeFileSync(scriptPath, source, "utf8");
  try {
    return execFileSync(process.execPath, [scriptPath], {
      cwd: backendDir,
      encoding: "utf8",
      timeout: 60_000,
      env: {
        ...process.env,
        DATABASE_URL: readBackendDatabaseUrl(),
        NODE_PATH: path.join(backendDir, "node_modules"),
        ...extraEnv,
      },
    });
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** Mirrors e2e/helpers/platformAdminSeeder.ts without importing TS from Node. */
function ensurePlatformAdmin(email, password) {
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
    '    await pool.query("UPDATE platform_users SET password_hash = $1, disabled_at = NULL, session_version = session_version + 1, updated_at = now() WHERE id = $2", [passwordHash, userId]);',
    "  } else {",
    '    userId = randomBytes(8).toString("hex");',
    "    await pool.query(\"INSERT INTO platform_users (id, email, name, password_hash, email_verified_at, role, session_version) VALUES ($1, $2, $3, $4, now(), 'admin', 0)\", [userId, email, 'Platform UIUX Review Admin', passwordHash]);",
    "  }",
    "  for (const perm of ['workspaces','onboard','settings','admins','system']) {",
    '    await pool.query("INSERT INTO platform_user_permissions (platform_user_id, permission_key, is_granted) VALUES ($1, $2, true) ON CONFLICT DO NOTHING", [userId, perm]);',
    "  }",
    "  await pool.end();",
    "})().catch((err) => { console.error(err); process.exit(1); });",
  ].join("\n");
  runDbScript(script, { E2E_SEED_EMAIL: email, E2E_SEED_PASSWORD: password });
}

function seed(subdomain) {
  const scripts = [
    "src/scripts/seed-20-contacts.ts",
    "src/scripts/seed-20-students.ts",
    "src/scripts/seed-20-sessions.ts",
    "src/scripts/seed-faculty-setup.ts",
    "src/scripts/seed-20-faculty.ts",
    "src/scripts/seed-20-invoices.ts",
  ];
  for (const script of scripts) {
    console.log(`[seed] ${script}`);
    execFileSync("pnpm", ["exec", "tsx", script, subdomain], {
      cwd: backendDir,
      stdio: "inherit",
      timeout: 180_000,
    });
  }
}

async function postJson(page, origin, targetPath, body) {
  if (!page.url().startsWith(origin)) {
    await page.goto(`${origin}/site.webmanifest`);
  }
  const result = await page.evaluate(
    async ({ target, payload }) => {
      const csrf = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)?.[1];
      const res = await fetch(target, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": decodeURIComponent(csrf) } : {}),
        },
        body: JSON.stringify(payload),
      });
      return { status: res.status, text: res.ok ? "" : await res.text() };
    },
    { target: targetPath, payload: body },
  );
  if (result.status >= 300) {
    throw new Error(`POST ${origin}${targetPath} -> ${result.status}: ${result.text}`);
  }
}

async function provision() {
  assertLocal();
  ensureDirs();
  const stamp = Date.now().toString().slice(-10);
  const subdomain = `uiuxreview${stamp}`;
  const tenantOrigin = `http://${subdomain}.localhost:${new URL(BASE_URL).port || "5173"}`;
  const platformEmail = `platform-uiux-${stamp}@test.com`;
  const adminEmail = `admin@${subdomain}.com`;

  console.log(`[provision] tenant ${subdomain} (${tenantOrigin})`);
  ensurePlatformAdmin(platformEmail, PLATFORM_PASSWORD);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await postJson(page, BASE_URL, "/api/platform/auth/login", {
      email: platformEmail,
      password: PLATFORM_PASSWORD,
    });
    await postJson(page, BASE_URL, "/api/auth/onboard", {
      madrasaName: "Al-Noor Model Madrasa",
      tagline: "Nurturing Knowledge & Character",
      adminName: "Ayesha Rahman",
      email: adminEmail,
      password: TENANT_TEMP_PASSWORD,
      currentPassword: PLATFORM_PASSWORD,
      subdomain,
      modules: MODULES,
      industryType: "madrasa",
      country: "United Kingdom",
      addressLine1: "42 Cedar Grove",
      city: "London",
      postalCode: "E1 6AN",
    });
    await postJson(page, tenantOrigin, "/api/auth/login", {
      email: adminEmail,
      password: TENANT_TEMP_PASSWORD,
    });
    await postJson(page, tenantOrigin, "/api/auth/change-password", {
      currentPassword: TENANT_TEMP_PASSWORD,
      newPassword: TENANT_PASSWORD,
    });
  } finally {
    await browser.close();
  }

  seed(subdomain);

  const state = {
    createdAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    subdomain,
    tenantOrigin,
    adminEmail,
    adminPassword: TENANT_PASSWORD,
    platformEmail,
    platformPassword: PLATFORM_PASSWORD,
  };
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  console.log(`[provision] wrote ${statePath}`);
}

const tenantStoragePath = path.join(outDir, "tenant-storage.json");
const platformStoragePath = path.join(outDir, "platform-storage.json");
const manifestPath = path.join(outDir, "manifest.json");
const ACK = "\u2713";

const CORE_SURFACES = [
  { name: "dashboard", path: "/", fullPage: true, axe: true },
  { name: "contacts", path: "/contacts", fullPage: false, axe: true },
  { name: "students", path: "/students", fullPage: false, axe: true },
  { name: "finance", path: "/finance", fullPage: false, axe: true },
  { name: "settings", path: "/settings", fullPage: true, axe: true },
];

const BREADTH_SURFACES = [
  "faculty",
  "enrollments",
  "sessions",
  "attendance",
  "hasanat-cards",
  "examinations",
  "question-bank",
  "workshops",
  "accounting",
  "obligations",
  "tasks",
  "messaging",
  "users",
  "profile",
  "notifications",
].map((slug) => ({
  name: slug,
  path: `/${slug}`,
  fullPage: false,
  axe: false,
}));

const PLATFORM_SURFACES = [
  "dashboard",
  "workspaces",
  "reports",
  "consolidation",
  "users",
  "settings",
  "activity-logs",
  "system",
  "design-system",
].map((slug) => ({
  name: `platform-${slug}`,
  path: `/platform/${slug}`,
  fullPage: false,
  axe: false,
  platform: true,
}));

function loadState() {
  return JSON.parse(readFileSync(statePath, "utf8"));
}

function manifest() {
  if (!existsSync(manifestPath)) return [];
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function record(entry) {
  const entries = manifest();
  entries.push(entry);
  writeFileSync(manifestPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

async function newContext(browser, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1440, height: 900 },
    colorScheme: options.theme ?? "light",
    reducedMotion: "reduce",
    locale: options.locale === "ar" ? "ar-SA" : options.locale === "ur" ? "ur-PK" : "en-GB",
    storageState: options.storageState,
  });
  await context.addInitScript(() => {
    window.__uiux = { lcp: 0, cls: 0, longTasks: [] };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__uiux.lcp = Math.max(window.__uiux.lcp, entry.startTime);
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__uiux.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__uiux.longTasks.push(Math.round(entry.duration));
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      /* PerformanceObserver unavailable — measurements stay at defaults. */
    }
  });
  return context;
}

async function settle(page, { main = true } = {}) {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  if (main) {
    await page
      .locator("#main-content")
      .first()
      .waitFor({ state: "visible", timeout: 25_000 })
      .catch(() => undefined);
  }
  await page
    .waitForFunction(() => document.fonts && document.fonts.status === "loaded", null, {
      timeout: 10_000,
    })
    .catch(() => undefined);
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15_000 })
    .catch(() => undefined);
  await page.evaluate(() => {
    document.querySelectorAll(".tsqd-open-btn-container").forEach((node) => node.remove());
  });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(350);
}

async function completeInstitutionSetup(page) {
  const defaults = [
    ["#setup-madrasaName", "Al-Noor Model Madrasa"],
    ["#setup-tagline", "Nurturing Knowledge & Character"],
    ["#setup-email", "admin@alnoor.example"],
    ["#setup-phone", "+44 7700 900123"],
    ["#setup-website", "https://alnoor.example"],
    ["#setup-addressLine1", "42 Cedar Grove"],
    ["#setup-city", "London"],
    ["#setup-region", "Greater London"],
    ["#setup-postalCode", "E1 6AN"],
    ["#setup-country", "United Kingdom"],
  ];
  for (const [selector, value] of defaults) {
    const input = page.locator(selector);
    if (await input.isVisible({ timeout: 1_000 }).catch(() => false)) {
      if (!(await input.inputValue())) await input.fill(value);
    }
  }
  const save = page.getByRole("button", { name: /Save.*(Dashboard|Profile)|Save|Complete/i });
  await save.first().click();
  await page
    .locator("#main-content")
    .first()
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => undefined);
  await page.waitForTimeout(1_200);
}

async function loginTenantPage(page, state) {
  await page.goto(`${state.tenantOrigin}/login`, { waitUntil: "domcontentloaded" });
  // `/login` itself renders a #main-content landmark, so it is not a reliable
  // "already signed in" signal. Wait for the email field; if the GuestRoute
  // redirects an existing session away, the field never appears.
  const email = page.locator('input[name="email"]');
  const entered = await email
    .waitFor({ state: "visible", timeout: 60_000 })
    .then(() => true)
    .catch(() => false);
  if (!entered) {
    await page.locator("#main-content").first().waitFor({ state: "visible", timeout: 10_000 });
    return false;
  }
  await page.fill('input[name="email"]', state.adminEmail);
  await page.fill('input[name="password"]', state.adminPassword);
  await page.click('button[type="submit"]');
  await page
    .locator("#main-content")
    .or(page.getByRole("heading", { name: /Complete Institution/i }))
    .first()
    .waitFor({ state: "visible", timeout: 60_000 });
  return page
    .getByRole("heading", { name: /Complete Institution/i })
    .isVisible()
    .catch(() => false);
}

async function loginPlatformPage(page, state) {
  await page.goto(`${state.baseUrl}/platform/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#platform-email").or(page.locator("#platform-setup-email")).first().waitFor({
    state: "visible",
    timeout: 30_000,
  });
  if (
    await page
      .locator("#platform-setup-email")
      .isVisible()
      .catch(() => false)
  ) {
    throw new Error("Platform first-run setup is active; run --provision to seed the admin first.");
  }
  await page.fill("#platform-email", state.platformEmail);
  await page.fill("#platform-password", state.platformPassword);
  await page.click('button[type="submit"]');
  await page
    .getByRole("heading", { name: /Dashboard|Welcome back|Workspaces|Madrasas/i })
    .or(page.locator('a[href="/platform/workspaces"]'))
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(800);
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const main = document.querySelector("#main-content") ?? document.body;
    const vw = document.documentElement.clientWidth;
    const truncations = [];
    for (const node of main.querySelectorAll("h1,h2,h3,p,span,td,th,a,button,label")) {
      const el = node;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
        if (!text || el.getAttribute("title") || el.closest("[title]")) continue;
        if (truncations.length < 8) {
          truncations.push({
            text,
            tag: el.tagName,
            width: el.clientWidth,
            scroll: el.scrollWidth,
          });
        }
      }
    }
    const sizes = {};
    for (const el of main.querySelectorAll("body *")) {
      const style = getComputedStyle(el);
      if (style.display === "none" || !el.textContent?.trim()) continue;
      const size = style.fontSize;
      sizes[size] = (sizes[size] ?? 0) + 1;
    }
    const smallTargets = [];
    for (const el of main.querySelectorAll("button,a,[role=button],input,select,textarea")) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || rect.width === 0) continue;
      if (rect.width < 24 || rect.height < 24) {
        if (smallTargets.length < 8) {
          smallTargets.push({
            tag: el.tagName,
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            label:
              (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40) || null,
          });
        }
      }
    }
    const perf = window.__uiux ?? { lcp: 0, cls: 0, longTasks: [] };
    return {
      url: location.href,
      viewportWidth: vw,
      overflow: document.documentElement.scrollWidth - vw,
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim() ?? null,
      truncations,
      fontSizes: sizes,
      smallTargets,
      lcp: Math.round(perf.lcp),
      cls: Number(perf.cls.toFixed(4)),
      longTasks: perf.longTasks.slice(-20),
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      dark: document.documentElement.classList.contains("dark"),
    };
  });
}

async function axeSummary(page) {
  try {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    return results.violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
        target: violation.nodes[0]?.target?.join(" >> ") ?? null,
      }));
  } catch (error) {
    return [{ id: "axe-error", impact: "serious", nodes: 1, target: String(error).slice(0, 200) }];
  }
}

async function capture(page, surface, contextLabel, options = {}) {
  const name = `${surface.name}-${contextLabel}`;
  const file = `${name}.png`;
  await page
    .locator("h1")
    .first()
    .waitFor({ state: "visible", timeout: 25_000 })
    .catch(() => undefined);
  // Dev-only TanStack Query devtools launcher — never part of the product.
  await page
    .addStyleTag({ content: ".tsqd-open-btn-container{display:none!important}" })
    .catch(() => undefined);
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(screensDir, file),
    fullPage: Boolean(surface.fullPage),
  });
  const metrics = await collectMetrics(page);
  const axe = options.axe ? await axeSummary(page) : [];
  const entry = {
    name,
    file,
    label: surface.name,
    context: contextLabel,
    path: surface.path,
    capturedAt: new Date().toISOString(),
    ...metrics,
    axe,
  };
  record(entry);
  console.log(
    `[shot] ${ACK} ${file}  overflow=${metrics.overflow} lcp=${metrics.lcp} cls=${metrics.cls} axe=${axe.length}`,
  );
  return entry;
}

async function prepareSessions(browser, state) {
  // 1. Tenant session: capture the first-run institution setup before completing it.
  const setupContext = await newContext(browser, {
    viewport: { width: 1440, height: 900 },
  });
  const setupPage = await setupContext.newPage();
  const needsSetup = await loginTenantPage(setupPage, state);
  if (needsSetup) {
    await settle(setupPage, { main: false });
    await capture(
      setupPage,
      { name: "institution-setup", path: "/institution-setup", fullPage: true },
      "1440-light-en",
      { axe: true },
    );
    await setupPage.setViewportSize({ width: 375, height: 812 });
    await settle(setupPage, { main: false });
    await capture(
      setupPage,
      { name: "institution-setup", path: "/institution-setup", fullPage: true },
      "375-light-en",
      { axe: false },
    );
    await setupPage.setViewportSize({ width: 1440, height: 900 });
    await completeInstitutionSetup(setupPage);
  }
  await settle(setupPage);
  await setupContext.storageState({ path: tenantStoragePath });
  await setupContext.close();

  // 2. Platform session.
  const platformContext = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const platformPage = await platformContext.newPage();
  await loginPlatformPage(platformPage, state);
  await platformContext.storageState({ path: platformStoragePath });
  await platformContext.close();
}

async function captureCore(browser, state, locale = "en") {
  const contexts = [
    { label: "1440-light", viewport: { width: 1440, height: 900 }, theme: "light" },
    { label: "1440-dark", viewport: { width: 1440, height: 900 }, theme: "dark" },
    { label: "375-light", viewport: { width: 375, height: 812 }, theme: "light" },
    { label: "375-dark", viewport: { width: 375, height: 812 }, theme: "dark" },
  ];
  const storageState = tenantStoragePath;
  for (const ctx of contexts) {
    const context = await newContext(browser, { ...ctx, storageState, locale });
    const page = await context.newPage();
    for (const surface of CORE_SURFACES) {
      await page.goto(`${state.tenantOrigin}${surface.path}`, { waitUntil: "domcontentloaded" });
      await settle(page);
      if (locale !== "en") {
        await page
          .waitForFunction((expected) => document.documentElement.lang === expected, locale, {
            timeout: 10_000,
          })
          .catch(() => undefined);
      }
      await capture(page, surface, `${ctx.label}-${locale}`, { axe: surface.axe });
    }
    await context.close();
  }
}

async function captureBreadth(browser, state) {
  const contexts = [
    { label: "1440-light", viewport: { width: 1440, height: 900 }, theme: "light" },
    { label: "375-light", viewport: { width: 375, height: 812 }, theme: "light" },
  ];
  for (const ctx of contexts) {
    const context = await newContext(browser, {
      ...ctx,
      storageState: tenantStoragePath,
      locale: "en",
    });
    const page = await context.newPage();
    for (const surface of BREADTH_SURFACES) {
      await page.goto(`${state.tenantOrigin}${surface.path}`, { waitUntil: "domcontentloaded" });
      await settle(page);
      await capture(page, surface, ctx.label, { axe: false });
    }
    await context.close();
  }
}

async function capturePlatform(browser, state) {
  const contexts = [
    { label: "1440-light", viewport: { width: 1440, height: 900 }, theme: "light" },
    { label: "1440-dark", viewport: { width: 1440, height: 900 }, theme: "dark" },
    { label: "375-light", viewport: { width: 375, height: 812 }, theme: "light" },
  ];
  for (const ctx of contexts) {
    const context = await newContext(browser, {
      ...ctx,
      storageState: platformStoragePath,
      locale: "en",
    });
    const page = await context.newPage();
    for (const surface of PLATFORM_SURFACES) {
      await page.goto(`${state.baseUrl}${surface.path}`, { waitUntil: "domcontentloaded" });
      await settle(page, { main: false });
      await capture(page, surface, ctx.label, { axe: true });
    }
    await context.close();
  }
}

async function captureEntry(browser, state) {
  // Apex entry and tenant login are unauthenticated by design.
  for (const ctx of [
    { label: "1440-light", viewport: { width: 1440, height: 900 }, theme: "light" },
    { label: "1440-dark", viewport: { width: 1440, height: 900 }, theme: "dark" },
    { label: "375-light", viewport: { width: 375, height: 812 }, theme: "light" },
  ]) {
    const context = await newContext(browser, ctx);
    const page = await context.newPage();
    for (const surface of [
      { name: "apex-entry", path: "/" },
      { name: "platform-login", path: "/platform/login" },
      { name: "tenant-login", path: `/login`, tenant: true },
      { name: "tenant-not-found", path: "/tenant-not-found?subdomain=missing-review" },
    ]) {
      const origin = surface.tenant ? state.tenantOrigin : state.baseUrl;
      await page.goto(`${origin}${surface.path}`, { waitUntil: "domcontentloaded" });
      await settle(page, { main: false });
      await capture(page, surface, `${ctx.label}-en`, { axe: true });
    }
    await context.close();
  }
}

function localeSettings(language) {
  return {
    language,
    timezone: "Asia/Karachi",
    dateFormat: "DD/MM/YYYY",
    emailNotifications: true,
    smsNotifications: false,
    whatsAppNotifications: false,
    twoFactor: false,
    sessionTimeout: "60",
    passwordPolicy: "strong",
    theme: "system",
    enabledModules: Object.fromEntries(MODULES.map((id) => [id, true])),
    llmProvider: "none",
    llmApiKey: "",
    llmConfigs: [],
  };
}

async function captureLocales(browser, state) {
  const plan = [
    { locale: "ar", label: "1440-light", viewport: { width: 1440, height: 900 }, theme: "light" },
    { locale: "ur", label: "375-light", viewport: { width: 375, height: 812 }, theme: "light" },
    { locale: "fa", label: "1024-light", viewport: { width: 1024, height: 768 }, theme: "light" },
  ];
  // One context for every locale. Language hydrates from the server-side
  // `global_settings` object on boot (2026-10-30 finding: language must survive a
  // new device), so the tenant is switched through the same persistence path the
  // Settings UI uses. Replaying the same storage state across three contexts also
  // races refresh-token rotation and 401s mid-run, so the session is refreshed in
  // place instead.
  const context = await newContext(browser, {
    viewport: plan[0].viewport,
    theme: "light",
    storageState: tenantStoragePath,
    locale: plan[0].locale,
  });
  const page = await context.newPage();
  const persistLocale = async (locale) => {
    try {
      await postJson(
        page,
        state.tenantOrigin,
        "/api/db/objects/global_settings",
        localeSettings(locale),
      );
    } catch (error) {
      if (!String(error).includes("401")) throw error;
      // The access token can lapse during a long capture run; sign in again and
      // retry once rather than abandoning the remaining locales.
      await loginTenantPage(page, state);
      await postJson(
        page,
        state.tenantOrigin,
        "/api/db/objects/global_settings",
        localeSettings(locale),
      );
    }
  };

  for (const item of plan) {
    await page.setViewportSize(item.viewport);
    await persistLocale(item.locale);
    for (const surface of CORE_SURFACES) {
      await page.goto(`${state.tenantOrigin}${surface.path}`, { waitUntil: "domcontentloaded" });
      await settle(page);
      await page
        .waitForFunction((expected) => document.documentElement.lang === expected, item.locale, {
          timeout: 12_000,
        })
        .catch(() => undefined);
      // The language pack is fetched asynchronously; html[lang] is set before it
      // lands, so wait for a known localized nav label before judging the screen.
      await page
        .waitForFunction(
          (label) => document.body.innerText.includes(label),
          { ar: "لوحة التحكم", ur: "ڈیش بورڈ", fa: "داشبورد" }[item.locale],
          { timeout: 20_000 },
        )
        .catch(() => undefined);
      await capture(page, surface, `${item.label}-${item.locale}`, {
        axe: surface.axe,
      });
    }
  }

  // Leave the review tenant in its original English state so later capture modes
  // are not silently localized.
  await persistLocale("en");
  await context.close();
}

async function captureStates(browser, state) {
  const desktop = await newContext(browser, {
    viewport: { width: 1440, height: 900 },
    storageState: tenantStoragePath,
  });
  const page = await desktop.newPage();
  const shot = async (name, label, options = {}) => {
    await page.waitForTimeout(500);
    await capture(page, { name, path: new URL(page.url()).pathname, fullPage: false }, label, {
      axe: options.axe ?? true,
    });
  };
  const closeOverlay = async () => {
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(400);
  };

  await page.goto(`${state.tenantOrigin}/contacts`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page
    .getByRole("tab", { name: "Contacts", exact: true })
    .click()
    .catch(() => undefined);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Syeda Amina Bukhari", exact: true }).click();
  await page.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 8_000 });
  await shot("contacts-detail-drawer", "1440-light-en");
  await closeOverlay();

  await page
    .getByRole("button", { name: /Columns/ })
    .first()
    .click();
  await page.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 8_000 });
  await shot("contacts-columns-dialog", "1440-light-en");
  await closeOverlay();

  await page.getByRole("tab", { name: /Reports/i }).click();
  await page.waitForTimeout(1_200);
  await shot("contacts-reports-tier", "1440-light-en", { axe: false });
  await page.getByRole("tab", { name: /Setup/i }).click();
  await page.waitForTimeout(1_200);
  await shot("contacts-setup-tier", "1440-light-en", { axe: false });

  await page.goto(`${state.tenantOrigin}/contacts`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page
    .getByRole("tab", { name: "Contacts", exact: true })
    .click()
    .catch(() => undefined);
  await page.waitForTimeout(800);
  await page
    .getByRole("button", { name: /Show Deleted|Deleted/i })
    .first()
    .click();
  await page.waitForTimeout(1_200);
  await shot("contacts-trash-empty", "1440-light-en");

  await page.goto(`${state.tenantOrigin}/students`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page
    .getByRole("tab", { name: "Students", exact: true })
    .click()
    .catch(() => undefined);
  await page.waitForTimeout(800);
  await page
    .getByRole("button", { name: /^Student$/ })
    .first()
    .click();
  await page.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 8_000 });
  await shot("students-create-modal", "1440-light-en");
  await closeOverlay();

  await page.keyboard.press("Meta+k");
  await page.waitForTimeout(900);
  await shot("command-palette", "1440-light-en");
  await closeOverlay();

  await page
    .getByRole("button", { name: /Notifications/i })
    .first()
    .click()
    .catch(() => undefined);
  await page.waitForTimeout(900);
  await shot("notifications-popover", "1440-light-en");
  await closeOverlay();

  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.waitForTimeout(1_000);
  await shot("offline-indicator", "1440-light-en", { axe: false });

  await desktop.close();

  const mobile = await newContext(browser, {
    viewport: { width: 375, height: 812 },
    storageState: tenantStoragePath,
  });
  const mobilePage = await mobile.newPage();
  const mobileShot = async (name) => {
    await mobilePage.waitForTimeout(500);
    await capture(
      mobilePage,
      { name, path: new URL(mobilePage.url()).pathname, fullPage: false },
      "375-light-en",
      { axe: true },
    );
  };
  await mobilePage.goto(`${state.tenantOrigin}/`, { waitUntil: "domcontentloaded" });
  await settle(mobilePage);
  await mobilePage
    .getByRole("button", { name: /open menu|navigation menu|menu/i })
    .first()
    .click();
  await mobilePage.waitForTimeout(800);
  await mobileShot("mobile-sidebar");
  await mobilePage.keyboard.press("Escape");

  await mobilePage.goto(`${state.tenantOrigin}/contacts`, { waitUntil: "domcontentloaded" });
  await settle(mobilePage);
  await mobilePage
    .getByRole("button", { name: "Syeda Amina Bukhari", exact: true })
    .click()
    .catch(() => undefined);
  await mobilePage.waitForTimeout(1_000);
  await mobileShot("contacts-detail-drawer");
  await mobile.close();

  const platform = await newContext(browser, {
    viewport: { width: 1440, height: 900 },
    storageState: platformStoragePath,
  });
  const platformPage = await platform.newPage();
  await platformPage.goto(`${state.baseUrl}/platform/dashboard`, { waitUntil: "domcontentloaded" });
  await settle(platformPage, { main: false });
  await platformPage
    .getByRole("button", { name: /Create New Madrasa/i })
    .first()
    .click();
  await platformPage
    .locator('[role="dialog"]')
    .first()
    .waitFor({ state: "visible", timeout: 8_000 });
  await platformPage.waitForTimeout(700);
  await capture(
    platformPage,
    { name: "platform-create-dialog", path: "/platform/dashboard", fullPage: false },
    "1440-light-en",
    { axe: true },
  );
  await platform.close();
}

async function runCapture(mode) {
  assertLocal();
  ensureDirs();
  const state = loadState();
  const browser = await chromium.launch();
  try {
    if (mode === "--session") {
      await prepareSessions(browser, state);
      return;
    }
    if (mode === "--capture-core") {
      await captureEntry(browser, state);
      await captureCore(browser, state, "en");
      await captureLocales(browser, state);
      return;
    }
    if (mode === "--capture-locales") {
      await captureLocales(browser, state);
      return;
    }
    if (mode === "--capture-breadth") {
      await captureBreadth(browser, state);
      await capturePlatform(browser, state);
      return;
    }
    if (mode === "--capture-states") {
      await captureStates(browser, state);
      return;
    }
    throw new Error(`Unknown capture mode: ${mode}`);
  } finally {
    await browser.close();
  }
}

/**
 * Post-fix verification mode: re-measures the invariants the resolution claims,
 * so evidence is reproducible without re-running the full capture corpus.
 * Exits non-zero when any invariant regresses.
 */
async function verify(browser, state) {
  const checks = [];
  const record = (name, ok, detail) => {
    checks.push({ name, ok, detail });
    console.log(
      `${ok ? "✓" : "✗"} ${name}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`,
    );
  };

  // A fresh context: the corpus storage state can hold expired cookies, and a
  // half-authenticated session used to make every measurement below vacuous.
  const context = await newContext(browser, {
    viewport: { width: 375, height: 812 },
    locale: "en",
  });
  const page = await context.newPage();

  await loginTenantPage(page, state);
  await settle(page);

  // 1. Quick-filter presets fit their labels; the tray is the scroller.
  await page.goto(`${state.tenantOrigin}/students`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const chips = await page.evaluate(() => {
    const groups = [...document.querySelectorAll("[role=group]")].filter(
      (group) => group.querySelectorAll("button[aria-pressed]").length >= 2,
    );
    return groups.map((group) => ({
      overflowX: getComputedStyle(group).overflowX,
      items: [...group.querySelectorAll("button[aria-pressed]")].map((button) => ({
        label: (button.textContent ?? "").trim().slice(0, 20),
        clientWidth: button.clientWidth,
        scrollWidth: button.scrollWidth,
      })),
    }));
  });
  const squeezed = chips.flatMap((group) =>
    group.items.filter((item) => item.scrollWidth > item.clientWidth + 1),
  );
  record(
    "quick-filter labels fit",
    squeezed.length === 0,
    squeezed.length === 0 ? "all presets fit" : squeezed,
  );

  // 1b. The metadata block is the density regression itself (407px -> ~250px at
  // 375). The 2-up layout is asserted by the later "mobile card metadata 2-up"
  // check, which also guards horizontal overflow.
  const metaDensity = await page.evaluate(() => {
    const grids = [...document.querySelectorAll("[data-card-meta-grid]")].filter(
      (grid) => grid.offsetParent !== null,
    );
    return {
      grids: grids.length,
      metaHeight: grids.length ? Math.round(grids[0].getBoundingClientRect().height) : 0,
    };
  });
  record(
    "card metadata height budget",
    metaDensity.grids > 0 && metaDensity.metaHeight > 0 && metaDensity.metaHeight <= 280,
    `${metaDensity.metaHeight}px`,
  );

  // 2. Settings integration panel copy column is no longer a 58px sliver.
  await page.goto(`${state.tenantOrigin}/settings`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const notificationsLink = page
    .locator("#main-content")
    .getByText("Notifications", { exact: true })
    .first();
  if (await notificationsLink.isVisible().catch(() => false)) {
    await notificationsLink.click().catch(() => undefined);
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll("p")].some((p) =>
            /Connect Gmail|SMTP|Outlook/i.test(p.textContent ?? ""),
          ),
        null,
        { timeout: 10_000 },
      )
      .catch(() => undefined);
  }
  const integrationWidth = await page.evaluate(() => {
    const description = [...document.querySelectorAll("p")].find((p) =>
      /Connect Gmail|SMTP|Outlook/i.test(p.textContent ?? ""),
    );
    return description ? Math.round(description.getBoundingClientRect().width) : 0;
  });
  record("integration panel copy width", integrationWidth >= 160, `${integrationWidth}px`);

  // 3. Open mobile drawer is axe-clean (the audit path added by UX-02).
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${state.tenantOrigin}/`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const menuButton = page.getByRole("button", { name: "Open Navigation Menu" }).first();
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click();
    const drawer = page.locator('[role="dialog"][aria-label="Mobile Navigation"]').first();
    const opened = await drawer
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    let serious = [];
    if (opened) {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
      serious = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact),
      );
    }
    record(
      "mobile drawer contrast/a11y",
      opened && serious.length === 0,
      opened ? `${serious.length} serious/critical` : "drawer did not open",
    );
    await page.keyboard.press("Escape").catch(() => undefined);
  } else {
    record("mobile drawer contrast/a11y", false, "trigger missing");
  }

  // 4. Desktop: sort targets, greeting height, collapsed insights.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${state.tenantOrigin}/students`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const sortTargets = await page.evaluate(() =>
    [...document.querySelectorAll("table thead th button")].slice(0, 6).map((button) => {
      const rect = button.getBoundingClientRect();
      const after = getComputedStyle(button, "::after");
      return {
        height: Math.max(
          rect.height,
          after.content === "none" ? 0 : Number.parseFloat(after.height) || 0,
        ),
      };
    }),
  );
  const smallTargets = sortTargets.filter((target) => target.height < 44);
  record(
    "sort-header hit area ≥ 44px",
    sortTargets.length > 0 && smallTargets.length === 0,
    sortTargets.length === 0
      ? "no sort headers rendered"
      : smallTargets.length
        ? smallTargets
        : `${sortTargets.length} headers`,
  );

  await page.goto(`${state.tenantOrigin}/`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const dashboard = await page.evaluate(() => {
    const heading = document.querySelector("h1");
    const insights = [...document.querySelectorAll("button")].find((button) =>
      /Show insights|Hide insights/i.test(button.textContent ?? ""),
    );
    return {
      h1Height: heading ? Math.round(heading.getBoundingClientRect().height) : 0,
      scrollHeight: document.documentElement.scrollHeight,
      insightsExpanded: insights?.getAttribute("aria-expanded") ?? "absent",
    };
  });
  record(
    "greeting ≤ 2 lines",
    dashboard.h1Height > 0 && dashboard.h1Height <= 80,
    `${dashboard.h1Height}px`,
  );
  record("dashboard height", dashboard.scrollHeight < 3000, `${dashboard.scrollHeight}px`);
  record(
    "insights collapsed by default",
    dashboard.insightsExpanded === "false",
    dashboard.insightsExpanded,
  );

  // 5. Mobile directory cards pack metadata two-up (UX-17).
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${state.tenantOrigin}/students`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const metaGrids = await page.evaluate(() => {
    const grids = [...document.querySelectorAll("#main-content div")].filter((element) => {
      const style = getComputedStyle(element);
      return (
        element.children.length > 1 &&
        style.display === "grid" &&
        style.borderTopWidth !== "0px" &&
        style.borderTopStyle !== "none"
      );
    });
    return {
      count: grids.length,
      columns: grids
        .slice(0, 3)
        .map((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length),
      heights: grids.slice(0, 3).map((grid) => Math.round(grid.getBoundingClientRect().height)),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  record(
    "mobile card metadata 2-up",
    metaGrids.count > 0 &&
      metaGrids.columns.every((columns) => columns === 2) &&
      metaGrids.overflow <= 0,
    metaGrids,
  );

  // 6. Caps tracking is neutralised in a real Arabic session. A runtime `lang`
  // flip is not a valid probe: the app boots its language from server settings,
  // and Chromium does not reliably re-evaluate the `:is([lang])` invalidation
  // for an attribute mutated after first paint (measured: still tracked).
  await postJson(page, state.tenantOrigin, "/api/db/objects/global_settings", localeSettings("ar"));
  await page.goto(`${state.tenantOrigin}/students`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const arabicTracking = await page.evaluate(() => {
    const element = [...document.querySelectorAll(".uppercase")].find(
      (node) => node.offsetParent !== null && /tracking-(wide|wider|widest)/.test(node.className),
    );
    return {
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      letterSpacing: element ? getComputedStyle(element).letterSpacing : null,
    };
  });
  record(
    "RTL caps tracking neutralised",
    arabicTracking.lang === "ar" && arabicTracking.letterSpacing === "normal",
    arabicTracking,
  );
  // Leave the review tenant in English for the next run.
  await postJson(page, state.tenantOrigin, "/api/db/objects/global_settings", localeSettings("en"));

  await context.close();
  const failed = checks.filter((check) => !check.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} verification checks passed`);
  if (failed.length > 0) process.exitCode = 1;
}

async function main() {
  const mode = process.argv[2];
  if (mode === "--provision") {
    await provision();
    return;
  }
  if (!existsSync(statePath) && mode !== "--help") {
    throw new Error(`No review tenant state at ${statePath}; run --provision first.`);
  }
  if (mode === "--verify") {
    assertLocal();
    ensureDirs();
    const state = loadState();
    const browser = await chromium.launch();
    try {
      await verify(browser, state);
    } finally {
      await browser.close();
    }
    return;
  }
  if (
    mode === "--session" ||
    mode === "--capture-core" ||
    mode === "--capture-locales" ||
    mode === "--capture-breadth" ||
    mode === "--capture-states"
  ) {
    await runCapture(mode);
    return;
  }
  if (mode === "--help" || !mode) {
    console.log(
      "Usage: --provision | --session | --capture-core | --capture-locales | --capture-breadth | --capture-states | --verify",
    );
    console.log(`Corpus: ${outDir} (override with UIUX_REVIEW_RUN=<date>)`);
    return;
  }
  throw new Error(`Unknown mode: ${mode}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

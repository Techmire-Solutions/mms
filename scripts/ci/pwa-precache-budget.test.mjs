import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BUDGETS,
  budgetsFromEnv,
  classifyPrecacheEntries,
  countLazyChunks,
  evaluateBudgets,
  findForbiddenClosureEntries,
  parsePrecacheEntries,
} from "../../scripts/check-pwa-precache.mjs";

/**
 * The PWA gate's budgets are only meaningful if the two precache populations are
 * told apart correctly and the lazy-loading floor actually fires. These tests pin
 * those three helpers; the CLI wiring around them is exercised by `pnpm run check:pwa`.
 */
test("classifyPrecacheEntries splits glob matches from transform additions", () => {
  const { globEntries, closureEntries } = classifyPrecacheEntries([
    "index.html",
    "site.webmanifest",
    "favicon.ico",
    "/assets/index-abc.js",
    "/assets/vendor-react-def.js",
  ]);
  assert.deepEqual(globEntries, ["index.html", "site.webmanifest", "favicon.ico"]);
  assert.deepEqual(closureEntries, ["/assets/index-abc.js", "/assets/vendor-react-def.js"]);
});

test("classifyPrecacheEntries handles an empty manifest", () => {
  assert.deepEqual(classifyPrecacheEntries([]), { globEntries: [], closureEntries: [] });
});

test("parsePrecacheEntries reads Workbox url/revision pairs", () => {
  const source =
    'precacheAndRoute([{url:"index.html",revision:null},{url:"/assets/a.js",revision:"abc"}])';
  assert.deepEqual(parsePrecacheEntries(source), ["index.html", "/assets/a.js"]);
  assert.deepEqual(parsePrecacheEntries("nothing here"), []);
});

test("countLazyChunks follows static imports only and tolerates cycles", () => {
  const manifest = {
    "index.html": { file: "index.js", isEntry: true, imports: ["a", "b"] },
    a: { file: "a.js", imports: ["c"] },
    b: { file: "b.js", imports: ["c"] },
    c: { file: "c.js", imports: ["a"] }, // cycle back to a
    d: { file: "d.js" }, // lazy
    e: { file: "e.js" }, // lazy
  };
  assert.deepEqual(countLazyChunks(manifest), { total: 6, closure: 4, lazy: 2 });
});

test("countLazyChunks returns null without an entry (fail-closed)", () => {
  assert.equal(countLazyChunks({ a: { file: "a.js" } }), null);
  assert.equal(countLazyChunks(null), null);
});

test("evaluateBudgets passes a measurement inside every ceiling", () => {
  assert.deepEqual(
    evaluateBudgets(
      {
        // Post-P8b baseline: the module host bridges moved into the lazy TenantRoutes chunk.
        globEntries: 7,
        closureEntries: 72,
        totalMb: 2.25,
        lazy: { total: 600, closure: 71, lazy: 529 },
      },
      DEFAULT_BUDGETS,
    ),
    [],
  );
});

test("evaluateBudgets reports each breach with its own message", () => {
  const budgets = { maxGlobEntries: 5, maxClosureEntries: 10, maxMb: 1, minLazyChunks: 100 };
  const violations = evaluateBudgets(
    { globEntries: 6, closureEntries: 11, totalMb: 2, lazy: { total: 50, closure: 40, lazy: 10 } },
    budgets,
  );
  assert.equal(violations.length, 4);
  assert.match(violations[0], /shell glob precaches 6 entries \(budget 5\)/);
  assert.match(violations[1], /entry closure precaches 11 entries \(budget 10\)/);
  assert.match(violations[2], /precache payload 2 MB exceeds 1 MB/);
  assert.match(violations[3], /only 10 lazy chunks remain \(floor 100\)/);
});

test("evaluateBudgets fails closed when the build manifest is missing", () => {
  const violations = evaluateBudgets(
    { globEntries: 1, closureEntries: 1, totalMb: 0.1, lazy: null },
    DEFAULT_BUDGETS,
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0], /build manifest has no entry/);
});

test("budgetsFromEnv honours overrides and ignores invalid values", () => {
  const overridden = budgetsFromEnv({
    PWA_PRECACHE_MAX_GLOB_ENTRIES: "12",
    PWA_PRECACHE_MAX_CLOSURE_ENTRIES: "320",
    PWA_PRECACHE_MAX_MB: "4.5",
    PWA_PRECACHE_MIN_LAZY_CHUNKS: "280",
  });
  assert.deepEqual(overridden, {
    maxGlobEntries: 12,
    maxClosureEntries: 320,
    maxMb: 4.5,
    minLazyChunks: 280,
  });

  const invalid = budgetsFromEnv({
    PWA_PRECACHE_MAX_GLOB_ENTRIES: "not-a-number",
    PWA_PRECACHE_MAX_MB: "-1",
  });
  assert.deepEqual(invalid, DEFAULT_BUDGETS);
});

test("findForbiddenClosureEntries flags host bridges in the entry closure", () => {
  const closure = [
    "/assets/index-abc.js",
    "/assets/IamHostBridge-def.js",
    "/assets/TenantModuleHostBridges-ghi.js",
    "/assets/sessionsModuleManifest-jkl.js",
  ];
  const hits = findForbiddenClosureEntries(closure);
  assert.equal(hits.length, 2);
  assert.ok(hits.every((entry) => /Bridge/.test(entry)));
});

test("module manifests may legitimately sit in the entry closure", () => {
  const closure = ["/assets/attendanceModuleManifest-abc.js", "/assets/vendor-react-def.js"];
  assert.deepEqual(findForbiddenClosureEntries(closure), []);
});

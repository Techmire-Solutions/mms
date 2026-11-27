#!/usr/bin/env node
/**
 * Frontend structural ratchets.
 *
 * The companion to scripts/check-code-norms.mjs: that script guards file *size*
 * and colour/type hygiene; this one guards where files *live*. Five norms:
 *
 *   1. `components/ui/` holds design-system *primitives only*. App-level
 *      composites belong in `components/app/` (mms-structure-naming §1).
 *   2. Tenant features use the canonical shape: `{Module}Page.tsx` (+ `components/`
 *      and `hooks/`) — no stray root-level components, no `controllers/`.
 *   3. Feature logic files (hooks/helpers/types) live in `features/<module>/hooks`
 *      or `features/<module>/lib`, never directly under `features/<module>/components`
 *      (mms-hooks §1).
 *   4. UI-presentation helpers live under `lib/ui`, not the `lib/` root.
 *   5. Barrels (`index.ts`) are an allowlist — no new ones without review.
 *   6. Template layouts use `/api/templates`, never the legacy document store
 *      (`getObject`/`saveObject`), which also POSTed a second, divergent copy.
 *
 * Ratchets, not cleanups: existing sites are grandfathered via BASELINE; lowering
 * a baseline as code improves is always welcome.
 *
 *   node scripts/check-frontend-structure.mjs
 *   node scripts/check-frontend-structure.mjs --json
 *   node scripts/check-frontend-structure.mjs --ratchet            # fail if a baseline can be lowered
 *   node scripts/check-frontend-structure.mjs --update-baselines   # lock in improvements
 *
 * Norms: mms-structure-naming.md §1/§3, mms-module-architecture.md §0, mms-hooks.md §1,
 * mms-ui-ux-design.md §1.
 */
import fs from "node:fs";
import path from "node:path";
import { assertScanDirs } from "./lib/repo-paths.mjs";

const ROOT = process.cwd();

/**
 * Both live console trees. `apps/platform-web/src/tenant/**` is the unrouted copy measured by
 * `pnpm run report:dead-sources` (P11a) and stays out of the barrel scan until it is pruned.
 */
const ROOTS = [
  {
    label: "tenant-web",
    fe: path.join(ROOT, "apps/tenant-web/src"),
    featuresDir: path.join(ROOT, "apps/tenant-web/src/tenant/features"),
    barrelSkip: null,
  },
  {
    label: "platform-web",
    fe: path.join(ROOT, "apps/platform-web/src"),
    featuresDir: path.join(ROOT, "apps/platform-web/src/platform/features"),
    barrelSkip: null, // the duplicate tenant copy was removed on 2026-11-27 (P14/P18)
  },
].map((root) => ({
  ...root,
  uiDir: path.join(root.fe, "components/ui"),
  libDir: path.join(root.fe, "lib"),
}));

// Fail closed: a renamed/removed root must break the gate, not silently retire it
// (docs/monorepo-migration-plan.md §2.7, U2).
assertScanDirs(
  Object.fromEntries(
    ROOTS.flatMap((root) => [
      [`${root.label} src`, root.fe],
      [`${root.label} features`, root.featuresDir],
      [`${root.label} lib`, root.libDir],
    ]),
  ),
  "frontend structure",
);

// `components/ui/` is no longer a required root: the primitive layer moved to `@mms/ui` and the app-local
// re-export shims were deleted (P12a/P12b), so an app may legitimately have no local ui directory. The
// norm still runs wherever the directory exists.
for (const root of ROOTS) {
  const localUi = fs.existsSync(root.uiDir) && fs.statSync(root.uiDir).isDirectory();
  if (!localUi) root.uiDir = null;
}

/**
 * Baselines measured when the ratchet landed; only lower them.
 * Every count here is a structural-debt inventory targeted by the
 * frontend-structure-modernization plan — the goal is 0 across the board.
 */
const BASELINE = {
  primitivesInUiLayer: 0,
  featureShapeDrift: 0,
  logicFilesInFeatureComponents: 0,
  uiHelpersInLibRoot: 0,
  unexpectedBarrels: 0,
  legacyTemplatePersistence: 0,
};

const toRel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const readDir = (p) => (isDir(p) ? fs.readdirSync(p, { withFileTypes: true }) : []);

function walkFiles(dir, out = []) {
  for (const entry of readDir(dir)) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage")
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

/** Norm 1 — the only files allowed in components/ui/. */
const PRIMITIVE_FILES = new Set([
  "alert-dialog.tsx",
  "avatar.tsx",
  "badge.tsx",
  "button.tsx",
  "calendar.tsx",
  "CalendarDropdown.tsx",
  "card.tsx",
  "checkbox.tsx",
  "dropdown-menu.tsx",
  "dropdown-menu-items.tsx",
  "form.tsx",
  "formStyles.ts",
  "formPrimitiveStyles.ts",
  "input.tsx",
  "label.tsx",
  "popover.tsx",
  "select.tsx",
  "skeleton.tsx",
  "slider.tsx",
  "switch.tsx",
  "table.tsx",
  "textarea.tsx",
  "toast.tsx",
  "toastStore.ts",
  "toaster.tsx",
  "tooltip.tsx",
  "use-toast.tsx",
]);
/** Subdirectories allowed under components/ui/ (generic engines). */
const PRIMITIVE_DIRS = new Set(["table"]);

/** Norm 4 — UI-presentation helpers that belong under lib/ui. */
const UI_HELPER_BASENAMES = new Set([
  "accentTone.ts",
  "attendanceStatusUi.ts",
  "avatarThemeTokens.ts",
  "brandingChartPalette.ts",
  "cardAccentTokens.ts",
  "dashboardNotificationIcons.ts",
  "dashboardWidgetColors.ts",
  "denominationColors.ts",
  "directoryCardAccent.ts",
  "extractLogoBrandColors.ts",
  "genderStatusBadge.ts",
  "genderUi.ts",
  "moduleStatusUi.ts",
  "printBrandingTokens.ts",
  "printTemplateStyles.ts",
  "semanticTone.ts",
]);

/** Norm 5 — the sanctioned barrels. */
const KEEP_BARRELS = new Set([
  "apps/tenant-web/src/components/common/index.ts",
  "apps/tenant-web/src/components/common/data-table/index.ts",
  "apps/tenant-web/src/components/common/descriptors/index.ts",
  "apps/tenant-web/src/components/common/work/index.ts",
  "apps/tenant-web/src/components/entry/index.ts",
  "apps/tenant-web/src/components/sequence-numbering/index.ts",
  "apps/tenant-web/src/components/template-editor/index.ts",
  "apps/tenant-web/src/tenant/components/reports/index.ts",
  "apps/tenant-web/src/tenant/features/sessions/components/tabs/class-detail/index.ts",
  // The platform console reuses the same reviewed shared barrels (verified imported from its live
  // `platform/` tree). Its dead `tenant/**` copy contributes no entries while P11a is unpruned.
  "apps/platform-web/src/components/common/index.ts",
  "apps/platform-web/src/components/common/data-table/index.ts",
  "apps/platform-web/src/components/common/descriptors/index.ts",
  "apps/platform-web/src/components/common/work/index.ts",
  "apps/platform-web/src/components/entry/index.ts",
  "apps/platform-web/src/components/sequence-numbering/index.ts",
  "apps/platform-web/src/components/template-editor/index.ts",
]);

// --- Norm 1: primitives only in components/ui/ -------------------------------
const uiViolations = ROOTS.flatMap((root) => {
  const out = [];
  if (!root.uiDir) return out;
  for (const file of walkFiles(root.uiDir)) {
    const rel = path.relative(root.uiDir, file).split(path.sep);
    if (rel.length === 1) {
      if (!PRIMITIVE_FILES.has(rel[0])) out.push(toRel(file));
    } else if (!PRIMITIVE_DIRS.has(rel[0])) {
      out.push(toRel(file));
    }
  }
  return out;
});

// --- Norm 2: canonical feature shape -----------------------------------------
const featureViolations = ROOTS.flatMap((root) => {
  const out = [];
  for (const entry of readDir(root.featuresDir)) {
    if (!entry.isDirectory()) continue;
    const feature = path.join(root.featuresDir, entry.name);
    const featureRel = toRel(feature);
    for (const child of readDir(feature)) {
      if (
        child.isFile() &&
        child.name.endsWith(".tsx") &&
        !/\.test\.tsx$/.test(child.name) &&
        !/Page\.tsx$/.test(child.name)
      ) {
        out.push(`${featureRel}/${child.name}`);
      }
    }
    if (!isDir(path.join(feature, "components"))) out.push(`${featureRel}/ (missing components/)`);
    if (isDir(path.join(feature, "controllers")))
      out.push(`${featureRel}/controllers/ (use hooks/)`);
  }
  return out;
});

// --- Norm 3: no logic .ts directly under features/*/components/ ---------------
const logicViolations = ROOTS.flatMap((root) => {
  const out = [];
  for (const entry of readDir(root.featuresDir)) {
    if (!entry.isDirectory()) continue;
    const componentsDir = path.join(root.featuresDir, entry.name, "components");
    for (const child of readDir(componentsDir)) {
      if (child.isFile() && child.name.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(child.name)) {
        out.push(toRel(path.join(componentsDir, child.name)));
      }
    }
  }
  return out;
});

// --- Norm 4: UI helpers out of the lib/ root ---------------------------------
const libHelperViolations = ROOTS.flatMap((root) => {
  const out = [];
  for (const child of readDir(root.libDir)) {
    if (child.isFile() && UI_HELPER_BASENAMES.has(child.name)) {
      out.push(toRel(path.join(root.libDir, child.name)));
    }
  }
  return out;
});

// --- Norm 5: barrels are an allowlist ----------------------------------------
const barrelViolations = ROOTS.flatMap((root) =>
  walkFiles(root.fe)
    .filter((file) => !root.barrelSkip || !file.startsWith(root.barrelSkip))
    .filter((f) => path.basename(f) === "index.ts")
    .map(toRel)
    .filter((rel) => !KEEP_BARRELS.has(rel)),
);

// --- Norm 6: template layouts must not use the legacy document store ---------
const TEMPLATE_MODULE_DIRS = [
  ...ROOTS.flatMap((root) => [
    path.join(root.fe, "components/template-editor"),
    path.join(root.fe, "lib/templates"),
  ]),
];
const TEMPLATE_MODULE_FILES = [
  "components/app/TemplateEditor.tsx",
  "components/app/DocumentTemplateEditor.tsx",
  "lib/invoiceTemplateStore.ts",
  "lib/invoiceTemplateFields.ts",
  "tenant/features/students/lib/studentCardTemplateStore.ts",
  "tenant/features/accounting/lib/voucherTemplateModel.ts",
  "tenant/features/examinations/components/ExaminationTemplateEditor.tsx",
  "tenant/features/hasanat/components/HasanatTemplateEditor.tsx",
  "tenant/features/students/components/card-template/StudentCardTemplateEditor.tsx",
  "tenant/features/accounting/components/AccountingVoucherTemplateEditor.tsx",
  "tenant/features/obligations/components/invoice/InvoiceTemplateEditor.tsx",
].map((rel) => path.join(ROOTS[0].fe, rel));

// Extracted module surfaces that own template layouts stay in this norm's scan set.
const TEMPLATE_MODULE_ABSOLUTE_FILES = [
  path.join(
    ROOT,
    "packages/modules/billing/src/frontend/tenant/components/FinanceTemplateEditor.tsx",
  ),
];

const LEGACY_TEMPLATE_PERSISTENCE_PATTERN =
  /(?:from\s+["\']@\/lib\/db["\']|\b(?:getObject|saveObject)\s*\()/;
const legacyTemplatePersistenceViolations = [
  ...TEMPLATE_MODULE_DIRS.flatMap((dir) => walkFiles(dir)),
  ...TEMPLATE_MODULE_FILES.filter((file) => fs.existsSync(file)),
  ...TEMPLATE_MODULE_ABSOLUTE_FILES.filter((file) => fs.existsSync(file)),
]
  .filter((file) => /\.(?:ts|tsx)$/.test(file) && !/\.test\.(?:ts|tsx)$/.test(file))
  .filter((file) => LEGACY_TEMPLATE_PERSISTENCE_PATTERN.test(fs.readFileSync(file, "utf8")))
  .map(toRel);

const uniqueLegacyTemplatePersistence = [...new Set(legacyTemplatePersistenceViolations)];

const results = [
  {
    name: "Non-primitive files in components/ui/",
    norm: "mms-structure-naming.md §1",
    count: uiViolations.length,
    baseline: BASELINE.primitivesInUiLayer,
    sample: uiViolations.slice(0, 8),
  },
  {
    name: "Feature-shape drift (root components / missing components/ / controllers/)",
    norm: "mms-module-architecture.md §0",
    count: featureViolations.length,
    baseline: BASELINE.featureShapeDrift,
    sample: featureViolations.slice(0, 8),
  },
  {
    name: "Logic .ts directly under features/*/components/",
    norm: "mms-hooks.md §1",
    count: logicViolations.length,
    baseline: BASELINE.logicFilesInFeatureComponents,
    sample: logicViolations.slice(0, 8),
  },
  {
    name: "UI helpers in the lib/ root (belong in lib/ui)",
    norm: "mms-ui-ux-design.md §1",
    count: libHelperViolations.length,
    baseline: BASELINE.uiHelpersInLibRoot,
    sample: libHelperViolations.slice(0, 8),
  },
  {
    name: "Barrels outside the allowlist",
    norm: "mms-structure-naming.md §1",
    count: barrelViolations.length,
    baseline: BASELINE.unexpectedBarrels,
    sample: barrelViolations.slice(0, 8),
  },
  {
    name: "Legacy document-store persistence in template modules",
    norm: "mms-dry.md §1",
    count: uniqueLegacyTemplatePersistence.length,
    baseline: BASELINE.legacyTemplatePersistence,
    sample: uniqueLegacyTemplatePersistence.slice(0, 8),
  },
];

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ results }, null, 2));
  process.exit(0);
}

const isRatchetMode = process.argv.includes("--ratchet");
const isUpdateBaselines = process.argv.includes("--update-baselines");

if (isUpdateBaselines) {
  const newBaseline = { ...BASELINE };
  let updated = false;
  for (const result of results) {
    if (result.count < result.baseline) {
      newBaseline[Object.keys(BASELINE)[results.indexOf(result)]] = result.count;
      updated = true;
    }
  }
  if (updated) {
    const scriptPath = path.join(ROOT, "scripts/check-frontend-structure.mjs");
    const content = fs.readFileSync(scriptPath, "utf8");
    const literal = `const BASELINE = {\n${Object.entries(newBaseline)
      .map(([k, v]) => `  ${k}: ${v},`)
      .join("\n")}\n};`;
    fs.writeFileSync(
      scriptPath,
      content.replace(/const BASELINE = \{[\s\S]*?\};/, literal),
      "utf8",
    );
    console.log("✅ Baselines ratcheted down:", newBaseline);
  } else {
    console.log("ℹ️ No baseline improvements to update.");
  }
  process.exit(0);
}

let regressions = 0;
let improvements = 0;
for (const result of results) {
  const delta = result.count - result.baseline;
  const mark = delta > 0 ? "✗" : "✓";
  if (delta > 0) regressions++;
  if (delta < 0 && result.baseline > 0) improvements++;
  console.log(
    `${mark} ${result.name}: ${result.count} (baseline ${result.baseline})  [${result.norm}]`,
  );
  if (delta < 0 && result.baseline > 0) {
    console.log(
      `   🎉 Improved by ${Math.abs(delta)}! Run with --update-baselines to ratchet down.`,
    );
  }
  if (delta > 0) for (const site of result.sample) console.log(`      ${site}`);
}

console.log("");
if (regressions > 0) {
  console.error(
    "💥 frontend-structure ratchet(s) regressed. Fix the new sites, or — only with a reviewed reason — lower the BASELINE in scripts/check-frontend-structure.mjs.",
  );
  process.exit(1);
}
if (isRatchetMode && improvements > 0) {
  console.error(
    "⚠️ Baseline(s) improved! Run 'node scripts/check-frontend-structure.mjs --update-baselines' to lock in improvements.",
  );
  process.exit(1);
}
console.log("✅ All frontend-structure ratchets held.");

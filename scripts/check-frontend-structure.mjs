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

const ROOT = process.cwd();
const FE = path.join(ROOT, "apps/frontend/src");
const UI_DIR = path.join(FE, "components/ui");
const FEATURES_DIR = path.join(FE, "tenant/features");
const LIB_DIR = path.join(FE, "lib");

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
  "apps/frontend/src/components/common/index.ts",
  "apps/frontend/src/components/common/data-table/index.ts",
  "apps/frontend/src/components/common/descriptors/index.ts",
  "apps/frontend/src/components/common/work/index.ts",
  "apps/frontend/src/components/entry/index.ts",
  "apps/frontend/src/components/sequence-numbering/index.ts",
  "apps/frontend/src/components/template-editor/index.ts",
  "apps/frontend/src/tenant/components/reports/index.ts",
  "apps/frontend/src/tenant/features/sessions/components/tabs/class-detail/index.ts",
]);

// --- Norm 1: primitives only in components/ui/ -------------------------------
const uiViolations = [];
for (const file of walkFiles(UI_DIR)) {
  const rel = path.relative(UI_DIR, file).split(path.sep);
  if (rel.length === 1) {
    if (!PRIMITIVE_FILES.has(rel[0])) uiViolations.push(toRel(file));
  } else if (!PRIMITIVE_DIRS.has(rel[0])) {
    uiViolations.push(toRel(file));
  }
}

// --- Norm 2: canonical feature shape -----------------------------------------
const featureViolations = [];
for (const entry of readDir(FEATURES_DIR)) {
  if (!entry.isDirectory()) continue;
  const feature = path.join(FEATURES_DIR, entry.name);
  const featureRel = toRel(feature);
  for (const child of readDir(feature)) {
    if (
      child.isFile() &&
      child.name.endsWith(".tsx") &&
      !/\.test\.tsx$/.test(child.name) &&
      !/Page\.tsx$/.test(child.name)
    ) {
      featureViolations.push(`${featureRel}/${child.name}`);
    }
  }
  if (!isDir(path.join(feature, "components")))
    featureViolations.push(`${featureRel}/ (missing components/)`);
  if (isDir(path.join(feature, "controllers")))
    featureViolations.push(`${featureRel}/controllers/ (use hooks/)`);
}

// --- Norm 3: no logic .ts directly under features/*/components/ ---------------
const logicViolations = [];
for (const entry of readDir(FEATURES_DIR)) {
  if (!entry.isDirectory()) continue;
  const componentsDir = path.join(FEATURES_DIR, entry.name, "components");
  for (const child of readDir(componentsDir)) {
    if (child.isFile() && child.name.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(child.name)) {
      logicViolations.push(toRel(path.join(componentsDir, child.name)));
    }
  }
}

// --- Norm 4: UI helpers out of the lib/ root ---------------------------------
const libHelperViolations = [];
for (const child of readDir(LIB_DIR)) {
  if (child.isFile() && UI_HELPER_BASENAMES.has(child.name)) {
    libHelperViolations.push(toRel(path.join(LIB_DIR, child.name)));
  }
}

// --- Norm 5: barrels are an allowlist ----------------------------------------
const barrelViolations = walkFiles(FE)
  .filter((f) => path.basename(f) === "index.ts")
  .map(toRel)
  .filter((rel) => !KEEP_BARRELS.has(rel));

// --- Norm 6: template layouts must not use the legacy document store ---------
const TEMPLATE_MODULE_DIRS = [
  path.join(FE, "components/template-editor"),
  path.join(FE, "lib/templates"),
];
const TEMPLATE_MODULE_FILES = [
  "components/app/TemplateEditor.tsx",
  "components/app/DocumentTemplateEditor.tsx",
  "lib/invoiceTemplateStore.ts",
  "lib/invoiceTemplateFields.ts",
  "tenant/features/students/lib/studentCardTemplateStore.ts",
  "tenant/features/accounting/lib/voucherTemplateModel.ts",
  "tenant/features/finance/components/FinanceTemplateEditor.tsx",
  "tenant/features/examinations/components/ExaminationTemplateEditor.tsx",
  "tenant/features/hasanat/components/HasanatTemplateEditor.tsx",
  "tenant/features/students/components/card-template/StudentCardTemplateEditor.tsx",
  "tenant/features/accounting/components/AccountingVoucherTemplateEditor.tsx",
  "tenant/features/obligations/components/invoice/InvoiceTemplateEditor.tsx",
].map((rel) => path.join(FE, rel));

const LEGACY_TEMPLATE_PERSISTENCE_PATTERN =
  /(?:from\s+["\']@\/lib\/db["\']|\b(?:getObject|saveObject)\s*\()/;
const legacyTemplatePersistenceViolations = [
  ...TEMPLATE_MODULE_DIRS.flatMap((dir) => walkFiles(dir)),
  ...TEMPLATE_MODULE_FILES.filter((file) => fs.existsSync(file)),
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

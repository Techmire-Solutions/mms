#!/usr/bin/env node
/**
 * MMS Shared UI Component Architecture & Governance Ratchet.
 *
 * Enforces the Single Source of Truth (SSOT) policy for UI primitives:
 *   1. All reusable primitives live in `@mms/ui` (`packages/ui`).
 *   2. Duplicate UI primitive definitions across Tenant Console and Platform Console are banned.
 *   3. Platform Console (`apps/frontend/src/platform/`) must import directly from `@mms/ui`,
 *      not from `@/components/ui/*`.
 *   4. Zero cross-console imports between `tenant/` and `platform/`.
 *   5. `apps/frontend/src/components/ui/` serves exclusively as a clean typed facade re-exporting
 *      from `@mms/ui`, with zero duplicate local JSX component implementations.
 *   6. Zero orphaned imports referencing non-existent or deprecated UI modules.
 *   7. Shared layer (src/lib, src/components, src/hooks, src/providers) never imports `@/platform/*`.
 *   8. New components/ui basenames must re-export `@mms/ui` or be listed local composites.
 *
 * Usage:
 *   node scripts/check-shared-ui.mjs
 *   node scripts/check-shared-ui.mjs --json
 *
 * Norms: mms-dry.md §1, mms-ui-ux-design.md §1, mms-structure-naming.md §1.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FE_SRC = path.join(ROOT, "apps/frontend/src");
const PLATFORM_DIR = path.join(FE_SRC, "platform");
const TENANT_DIR = path.join(FE_SRC, "tenant");
const UI_FACADE_DIR = path.join(FE_SRC, "components/ui");
const SHARED_UI_DIR = path.join(ROOT, "packages/ui/src");

const toRel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

function walkFiles(dir, filter = () => true, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, filter, out);
    } else if (filter(full)) {
      out.push(full);
    }
  }
  return out;
}

const isCodeFile = (f) => /\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f);

/**
 * Fail closed: this ratchet is the only automated guard for the console split, so
 * a renamed or removed scan root must fail instead of reporting "0 violations"
 * (docs/monorepo-migration-plan.md §2.7, U2). Mirrored as a skill script, so it
 * carries this guard locally rather than importing scripts/lib/repo-paths.mjs.
 */
const scanErrors = [];
function assertScanned(label, dir, files) {
  if (!fs.existsSync(dir)) scanErrors.push(`${label}: missing ${toRel(dir)}`);
  else if (files.length === 0) scanErrors.push(`${label}: no source files under ${toRel(dir)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Check: Platform Console must not import from "@/components/ui/*"
// ─────────────────────────────────────────────────────────────────────────────
const platformUiImports = [];
const platformFiles = walkFiles(PLATFORM_DIR, isCodeFile);
assertScanned("Platform Console", PLATFORM_DIR, platformFiles);

const FORBIDDEN_PLATFORM_UI_IMPORT = /from\s+["']@\/components\/ui\/([^"']+)["']/g;
const FORBIDDEN_PLATFORM_UI_ROOT_IMPORT = /from\s+["']@\/components\/ui["']/g;

for (const file of platformFiles) {
  const content = fs.readFileSync(file, "utf8");
  let match;
  while ((match = FORBIDDEN_PLATFORM_UI_IMPORT.exec(content)) !== null) {
    platformUiImports.push({
      file: toRel(file),
      importSpecifier: `@/components/ui/${match[1]}`,
      rule: "Platform Console must import from '@mms/ui', not '@/components/ui/*'",
    });
  }
  while ((match = FORBIDDEN_PLATFORM_UI_ROOT_IMPORT.exec(content)) !== null) {
    platformUiImports.push({
      file: toRel(file),
      importSpecifier: "@/components/ui",
      rule: "Platform Console must import from '@mms/ui', not '@/components/ui'",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Check: Cross-Console Import Boundaries (Tenant <-> Platform)
// ─────────────────────────────────────────────────────────────────────────────
const crossConsoleImports = [];

const TENANT_IMPORTING_PLATFORM = /from\s+["']@\/platform\/([^"']+)["']/g;
// Dynamic `import()` / `require()` bypass `no-restricted-imports`, so the static
// regex alone missed the one form a lazy route loader actually uses.
const TENANT_IMPORTING_PLATFORM_DYNAMIC =
  /(?:import\s*\(\s*|require\s*\(\s*)["']@\/platform\/([^"']+)["']/g;
const tenantFiles = walkFiles(TENANT_DIR, isCodeFile);
assertScanned("Tenant Console", TENANT_DIR, tenantFiles);

// Zero cross-console imports between Tenant and Platform
const CROSS_CONSOLE_ALLOWLIST = new Set([]);

for (const file of tenantFiles) {
  const content = fs.readFileSync(file, "utf8");
  let match;
  while ((match = TENANT_IMPORTING_PLATFORM.exec(content)) !== null) {
    const spec = `@/platform/${match[1]}`;
    const key = `${toRel(file)}:${spec}`;
    if (!CROSS_CONSOLE_ALLOWLIST.has(key)) {
      crossConsoleImports.push({
        file: toRel(file),
        importSpecifier: spec,
        rule: "Tenant Console must never import from Platform Console (@/platform/*)",
      });
    }
  }
  let dynamicMatch;
  while ((dynamicMatch = TENANT_IMPORTING_PLATFORM_DYNAMIC.exec(content)) !== null) {
    crossConsoleImports.push({
      file: toRel(file),
      importSpecifier: `@/platform/${dynamicMatch[1]}`,
      rule: "Tenant Console must never dynamically import Platform Console (@/platform/*)",
    });
  }
}

const PLATFORM_IMPORTING_TENANT = /from\s+["']@\/tenant\/([^"']+)["']/g;
const PLATFORM_IMPORTING_TENANT_DYNAMIC =
  /(?:import\s*\(\s*|require\s*\(\s*)["']@\/tenant\/([^"']+)["']/g;
for (const file of platformFiles) {
  const content = fs.readFileSync(file, "utf8");
  let match;
  while ((match = PLATFORM_IMPORTING_TENANT.exec(content)) !== null) {
    const spec = `@/tenant/${match[1]}`;
    const key = `${toRel(file)}:${spec}`;
    if (!CROSS_CONSOLE_ALLOWLIST.has(key)) {
      crossConsoleImports.push({
        file: toRel(file),
        importSpecifier: spec,
        rule: "Platform Console must never import from Tenant Console (@/tenant/*)",
      });
    }
  }
  let dynamicMatch;
  while ((dynamicMatch = PLATFORM_IMPORTING_TENANT_DYNAMIC.exec(content)) !== null) {
    crossConsoleImports.push({
      file: toRel(file),
      importSpecifier: `@/tenant/${dynamicMatch[1]}`,
      rule: "Platform Console must never dynamically import Tenant Console (@/tenant/*)",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Check: Facade Purity in apps/frontend/src/components/ui/
//    Components that exist in @mms/ui must only re-export from @mms/ui.
// ─────────────────────────────────────────────────────────────────────────────
const facadeViolations = [];
const facadeFiles = walkFiles(UI_FACADE_DIR, (f) => f.endsWith(".tsx") || f.endsWith(".ts"));
assertScanned("UI facade", UI_FACADE_DIR, facadeFiles);

const SHARED_PRIMITIVE_NAMES = new Set([
  "alert-dialog.tsx",
  "avatar.tsx",
  "badge.tsx",
  "button.tsx",
  "card.tsx",
  "checkbox.tsx",
  "dropdown-menu.tsx",
  "dropdown-menu-items.tsx",
  "formStyles.ts",
  "input.tsx",
  "label.tsx",
  "popover.tsx",
  "select.tsx",
  "skeleton.tsx",
  "slider.tsx",
  "switch.tsx",
  "table.tsx",
  "TableCell.tsx",
  "TableHead.tsx",
  "TableSkeleton.tsx",
  "TableEmpty.tsx",
  "tableTypes.ts",
  "tableUtils.ts",
  "useTableSort.ts",
  "textarea.tsx",
  "toast.tsx",
  "toaster.tsx",
  "toastStore.ts",
  "tooltip.tsx",
  "use-toast.tsx",
]);

for (const file of facadeFiles) {
  const base = path.basename(file);
  if (!SHARED_PRIMITIVE_NAMES.has(base)) continue;

  const content = fs.readFileSync(file, "utf8");
  // A clean facade should re-export from "@mms/ui"
  if (!content.includes('from "@mms/ui"') && !content.includes("from '@mms/ui'")) {
    facadeViolations.push({
      file: toRel(file),
      issue: `Primitive facade ${base} must re-export from '@mms/ui'`,
    });
  }

  // A facade must not declare fresh JSX implementations (<div, <button, etc.)
  // (allow Table's subcomponents if typed, but primitive implementation must come from @mms/ui)
  const hasLocalFunctionComponent =
    /const\s+[A-Z][A-Za-z0-9]+\s*=\s*\([^)]*\)\s*=>\s*<[a-z]+/m.test(content) &&
    base !== "table.tsx"; // table has helper subcomponents
  if (hasLocalFunctionComponent) {
    facadeViolations.push({
      file: toRel(file),
      issue: `Primitive facade ${base} defines local JSX implementation instead of re-exporting from @mms/ui`,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Check: Duplicate UI Primitive Definitions in Platform or Tenant
// ─────────────────────────────────────────────────────────────────────────────
const duplicatePrimitiveFiles = [];
const BANNED_LOCAL_PRIMITIVES = new Set([
  "AlertDialog.tsx",
  "Button.tsx",
  "Badge.tsx",
  "Input.tsx",
  "Checkbox.tsx",
  "Switch.tsx",
  "Select.tsx",
  "Textarea.tsx",
  "Slider.tsx",
  "Label.tsx",
  "Card.tsx",
  "DropdownMenu.tsx",
  "Popover.tsx",
  "Tooltip.tsx",
  "Skeleton.tsx",
  "Avatar.tsx",
  "Toast.tsx",
  "Toaster.tsx",
  "Callout.tsx",
  "WarningCallout.tsx",
  "ErrorState.tsx",
  "CardSkeleton.tsx",
  "StatsSkeleton.tsx",
  "TableSkeleton.tsx",
  "TableEmpty.tsx",
  "TableCell.tsx",
  "TableHead.tsx",
  "DensityToggle.tsx",
  "LeadingIconInput.tsx",
  "CopyButton.tsx",
  "NotificationsPopover.tsx",
  "PasswordStrengthMeter.tsx",
  "PasswordInput.tsx",
  "OtpInput.tsx",
  "CardTitleBar.tsx",
  "SectionCard.tsx",
  "WidgetCard.tsx",
  "WidgetCardHeader.tsx",
  "Breadcrumb.tsx",
  "TypedConfirmDialog.tsx",
  "SectionLabel.tsx",
  "FormSubmitActions.tsx",
  "ProgressBar.tsx",
  "WizardStepIndicator.tsx",
  "ListPagination.tsx",
  "StatusBadge.tsx",
  "CompactSegmentedControl.tsx",
  "ConfirmAlertDialog.tsx",
  "ReviewList.tsx",
  "FormCheckboxCard.tsx",
  "CredentialsResultCard.tsx",
  "AppFooter.tsx",
  "SessionTimeoutModal.tsx",
  "SearchBar.tsx",
  "FormSelect.tsx",
  "UserAvatar.tsx",
  "UserNavDropdown.tsx",
  "IntegrationPanelChrome.tsx",
  "LogoMark.tsx",
  "PlatformLogoMark.tsx",
  "PlatformIntegrationPanelChrome.tsx",
  "PlatformWorkspaceDensityToggle.tsx",
  "PlatformWorkspaceVirtualTable.tsx",
  "WorkspaceLogo.tsx",
  "ToggleRow.tsx",
  "TableCellLink.tsx",
  "SectionHeader.tsx",
  "LoadingState.tsx",
]);

for (const file of [...platformFiles, ...tenantFiles]) {
  const base = path.basename(file);
  if (BANNED_LOCAL_PRIMITIVES.has(base)) {
    // Check if it's in a features directory without feature prefix
    const rel = toRel(file);
    duplicatePrimitiveFiles.push({
      file: rel,
      issue: `Forbidden duplicate UI primitive file '${base}'. Reusable primitives must reside in '@mms/ui'.`,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Check: Orphaned Imports of Deleted/Deprecated UI Files
// ─────────────────────────────────────────────────────────────────────────────
const orphanedImports = [];
const allFrontendFiles = walkFiles(FE_SRC, isCodeFile);
assertScanned("Frontend source", FE_SRC, allFrontendFiles);
const sharedUiFiles = walkFiles(SHARED_UI_DIR, isCodeFile);
assertScanned("Shared UI", SHARED_UI_DIR, sharedUiFiles);

// Check if any file imports from non-existent @/components/ui/ files
const UI_IMPORT_REGEX = /from\s+["']@\/components\/ui\/([^"']+)["']/g;

for (const file of allFrontendFiles) {
  const content = fs.readFileSync(file, "utf8");
  let match;
  while ((match = UI_IMPORT_REGEX.exec(content)) !== null) {
    const importedBase = match[1];
    // Check if imported file exists in UI_FACADE_DIR
    const candidateTsx = path.join(UI_FACADE_DIR, `${importedBase}.tsx`);
    const candidateTs = path.join(UI_FACADE_DIR, `${importedBase}.ts`);
    const candidateDir = path.join(UI_FACADE_DIR, importedBase);

    if (
      !fs.existsSync(candidateTsx) &&
      !fs.existsSync(candidateTs) &&
      !fs.existsSync(candidateDir)
    ) {
      orphanedImports.push({
        file: toRel(file),
        importSpecifier: `@/components/ui/${importedBase}`,
        issue: `Orphaned import: target file '@/components/ui/${importedBase}' does not exist on disk`,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Check: Shared Layer Must Not Import Platform Console Code
//    Files under src/lib, src/components, src/hooks, and src/providers are
//    console-agnostic SSOT. They may never import @/platform/* — that dependency
//    direction is inverted (themeScope inversion) and would entangle the consoles.
//    Allowlist is empty by policy.
// ─────────────────────────────────────────────────────────────────────────────
const sharedLayerPlatformImports = [];
const SHARED_LAYER_DIRS = ["lib", "components", "hooks", "providers"].map((dir) =>
  path.join(FE_SRC, dir),
);
// Cross-console contract specs (e.g. the shared command-palette keyboard contract
// that mounts both consoles) are allowed to span consoles; the ban targets
// shared-layer production code (SSOT files must not depend on @/platform/*).
const isSharedLayerSpec = (f) => /\.(test|spec)\.(ts|tsx)$/.test(f);
const SHARED_LAYER_FILES = SHARED_LAYER_DIRS.flatMap((dir) =>
  walkFiles(dir, (f) => isCodeFile(f) && !isSharedLayerSpec(f)),
);

const SHARED_LAYER_PLATFORM_IMPORT = /from\s+["']@\/platform\/([^"']+)["']/g;
const SHARED_LAYER_PLATFORM_DYNAMIC_IMPORT =
  /(?:import\s*\(\s*|require\s*\(\s*)["']@\/platform\/([^"']+)["']/g;
const SHARED_LAYER_PLATFORM_ALLOWLIST = new Set([]);
/**
 * The only sanctioned dual-console bridge files. They exist solely until the P8
 * split deletes them, and P9 removes this set — after which any dynamic platform
 * import from the shared layer fails again. Static imports are never exempt.
 */
const TRANSITIONAL_DUAL_CONSOLE = new Set([
  "components/routing/HostRoutes.tsx",
  "lib/routing/routePrefetch.ts",
]);
const sanctionedDualConsole = [];

for (const file of SHARED_LAYER_FILES) {
  const content = fs.readFileSync(file, "utf8");
  let match;
  while ((match = SHARED_LAYER_PLATFORM_IMPORT.exec(content)) !== null) {
    const spec = `@/platform/${match[1]}`;
    const key = `${toRel(file)}:${spec}`;
    if (!SHARED_LAYER_PLATFORM_ALLOWLIST.has(key)) {
      sharedLayerPlatformImports.push({
        file: toRel(file),
        importSpecifier: spec,
        rule: "Shared layer (src/lib, src/components, src/hooks, src/providers) must never import from Platform Console (@/platform/*)",
      });
    }
  }
  // Allowlist keys are app-relative (`components/routing/HostRoutes.tsx`).
  const feRel = path.relative(FE_SRC, file).split(path.sep).join("/");
  if (TRANSITIONAL_DUAL_CONSOLE.has(feRel)) {
    sanctionedDualConsole.push(feRel);
    continue;
  }
  let dynamicMatch;
  while ((dynamicMatch = SHARED_LAYER_PLATFORM_DYNAMIC_IMPORT.exec(content)) !== null) {
    sharedLayerPlatformImports.push({
      file: rel,
      importSpecifier: `@/platform/${dynamicMatch[1]}`,
      rule: "Shared layer must never dynamically import Platform Console (@/platform/*)",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Check: New UI Facade Basenames Are Re-exports or Deliberate Local Composites
//    Any basename under components/ui/ that is not an established shared
//    primitive facade must either re-export from @mms/ui or be listed in
//    LOCAL_COMPOSITE_ALLOWLIST (a deliberate, reviewed local composite).
// ─────────────────────────────────────────────────────────────────────────────
const newFacadeViolations = [];
const LOCAL_COMPOSITE_ALLOWLIST = new Set([
  "form.tsx",
  "calendar.tsx",
  "CalendarDropdown.tsx",
  "formPrimitiveStyles.ts",
  "formStyles.ts",
]);

for (const file of facadeFiles) {
  const base = path.basename(file);
  if (SHARED_PRIMITIVE_NAMES.has(base) || LOCAL_COMPOSITE_ALLOWLIST.has(base)) continue;

  const content = fs.readFileSync(file, "utf8");
  if (!content.includes('from "@mms/ui"') && !content.includes("from '@mms/ui'")) {
    newFacadeViolations.push({
      file: toRel(file),
      issue: `New UI facade basename '${base}' must re-export from '@mms/ui' or be added to LOCAL_COMPOSITE_ALLOWLIST`,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Check: Single table engine in @mms/ui
//    WorkBatchTable (packages/fe-core/src/components) is the sole table
//    engine across Tenant and Platform Consoles. @mms/ui ships only low-level
//    table primitives; a second DataTable/Pagination-style engine is banned. New
//    primitives require an explicit allowlist entry (a deliberate, reviewed change).
// ─────────────────────────────────────────────────────────────────────────────
const SANCTIONED_TABLE_PRIMITIVES = new Set([
  "Table.tsx",
  "TableCell.tsx",
  "TableHead.tsx",
  "TableSkeleton.tsx",
  "TableEmpty.tsx",
  "TableCellLink.tsx",
  "ListPagination.tsx",
  "DensityToggle.tsx",
  "useTableSort.ts",
  "tableTypes.ts",
  "tableUtils.ts",
  "index.ts",
]);

const tablePrimitiveViolations = [];
const sharedTableDir = path.join(SHARED_UI_DIR, "table");
if (fs.existsSync(sharedTableDir)) {
  for (const entry of fs.readdirSync(sharedTableDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const base = entry.name;
    if (/\.test\.(ts|tsx)$/.test(base)) continue;
    if (/\.(ts|tsx)$/.test(base) && !SANCTIONED_TABLE_PRIMITIVES.has(base)) {
      tablePrimitiveViolations.push({
        file: toRel(path.join(sharedTableDir, base)),
        issue:
          `Unexpected table primitive '${base}' in @mms/ui. The single table engine is ` +
          "WorkBatchTable (packages/fe-core/src/components/WorkBatchTable.tsx); " +
          "add new low-level primitives to SANCTIONED_TABLE_PRIMITIVES only as a deliberate decision.",
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary & Reporting
// ─────────────────────────────────────────────────────────────────────────────
const totalViolations =
  scanErrors.length +
  platformUiImports.length +
  crossConsoleImports.length +
  facadeViolations.length +
  duplicatePrimitiveFiles.length +
  orphanedImports.length +
  sharedLayerPlatformImports.length +
  newFacadeViolations.length +
  tablePrimitiveViolations.length;

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      {
        totalViolations,
        scanErrors,
        platformUiImports,
        crossConsoleImports,
        facadeViolations,
        duplicatePrimitiveFiles,
        orphanedImports,
        sharedLayerPlatformImports,
        newFacadeViolations,
        tablePrimitiveViolations,
      },
      null,
      2,
    ),
  );
  process.exit(totalViolations > 0 ? 1 : 0);
}

console.log("=== MMS Shared UI Architecture & Governance Check ===");
console.log(`✓ Scanned ${platformFiles.length} Platform Console files`);
console.log(`✓ Scanned ${tenantFiles.length} Tenant Console files`);
console.log(`✓ Scanned ${facadeFiles.length} UI facade files`);
console.log(`✓ Scanned ${allFrontendFiles.length} total frontend source files\n`);

let passed = true;

if (platformUiImports.length > 0) {
  passed = false;
  console.error(
    `❌ Platform Console imports from @/components/ui/* (${platformUiImports.length} violations):`,
  );
  for (const v of platformUiImports) {
    console.error(`   - ${v.file}: ${v.importSpecifier}`);
  }
} else {
  console.log("✅ Platform Console imports: 100% direct from @mms/ui (0 violations)");
}

if (crossConsoleImports.length > 0) {
  passed = false;
  console.error(`❌ Cross-console boundary violations (${crossConsoleImports.length} violations):`);
  for (const v of crossConsoleImports) {
    console.error(`   - ${v.file}: ${v.importSpecifier} (${v.rule})`);
  }
} else {
  console.log(
    "✅ Cross-console boundaries: strictly isolated between Tenant and Platform (0 violations)",
  );
}

if (facadeViolations.length > 0) {
  passed = false;
  console.error(`❌ Facade purity violations (${facadeViolations.length} violations):`);
  for (const v of facadeViolations) {
    console.error(`   - ${v.file}: ${v.issue}`);
  }
} else {
  console.log("✅ UI Facades: all 18 primitives cleanly delegate to @mms/ui (0 violations)");
}

if (duplicatePrimitiveFiles.length > 0) {
  passed = false;
  console.error(
    `❌ Duplicate UI primitive files detected (${duplicatePrimitiveFiles.length} violations):`,
  );
  for (const v of duplicatePrimitiveFiles) {
    console.error(`   - ${v.file}: ${v.issue}`);
  }
} else {
  console.log("✅ Duplicate UI primitives: zero duplicate files across consoles (0 violations)");
}

if (orphanedImports.length > 0) {
  passed = false;
  console.error(`❌ Orphaned imports detected (${orphanedImports.length} violations):`);
  for (const v of orphanedImports) {
    console.error(`   - ${v.file}: ${v.issue}`);
  }
} else {
  console.log("✅ Orphaned imports: zero unresolved UI imports across codebase (0 violations)");
}

if (sharedLayerPlatformImports.length > 0) {
  passed = false;
  console.error(
    `❌ Shared layer imports from @/platform/* (${sharedLayerPlatformImports.length} violations):`,
  );
  for (const v of sharedLayerPlatformImports) {
    console.error(`   - ${v.file}: ${v.importSpecifier} (${v.rule})`);
  }
} else {
  console.log("✅ Shared layer: zero imports from Platform Console @/platform/* (0 violations)");
}

if (newFacadeViolations.length > 0) {
  passed = false;
  console.error(`❌ Unlisted UI facade basenames (${newFacadeViolations.length} violations):`);
  for (const v of newFacadeViolations) {
    console.error(`   - ${v.file}: ${v.issue}`);
  }
} else {
  console.log("✅ UI facade basenames: all re-export @mms/ui or are listed local composites (0 violations)");
}

if (tablePrimitiveViolations.length > 0) {
  passed = false;
  console.error(
    `❌ Unexpected table primitives in @mms/ui (${tablePrimitiveViolations.length} violations):`,
  );
  for (const v of tablePrimitiveViolations) {
    console.error(`   - ${v.file}: ${v.issue}`);
  }
} else {
  console.log("✅ Single table engine: @mms/ui ships only sanctioned table primitives (0 violations)");
}

if (scanErrors.length > 0) {
  passed = false;
  console.error(`❌ Fail-closed scan roots (${scanErrors.length}):`);
  for (const error of scanErrors) console.error(`   - ${error}`);
} else {
  console.log("✅ Scan roots: every scan root exists and contains source files (0 violations)");
}

if (sanctionedDualConsole.length > 0) {
  console.log(
    `ℹ Transitional dual-console bridge files (delete in P8): ${sanctionedDualConsole.join(", ")}`,
  );
}

console.log("\n=======================================================");
if (passed) {
  console.log("✨ All Shared UI component governance checks passed cleanly.\n");
  process.exit(0);
} else {
  console.error(`💥 Shared UI governance check failed with ${totalViolations} violation(s).\n`);
  process.exit(1);
}

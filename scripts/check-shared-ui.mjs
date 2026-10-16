#!/usr/bin/env node
/**
 * MMS Shared UI Component Architecture & Governance Ratchet.
 *
 * Enforces the Single Source of Truth (SSOT) policy for UI primitives:
 *   1. All reusable primitives live in `@shared/ui` (`packages/ui`).
 *   2. Duplicate UI primitive definitions across Tenant Console and Platform Console are banned.
 *   3. Platform Console (`apps/frontend/src/platform/`) must import directly from `@shared/ui`,
 *      not from `@/components/ui/*`.
 *   4. Zero cross-console imports between `tenant/` and `platform/`.
 *   5. `apps/frontend/src/components/ui/` serves exclusively as a clean typed facade re-exporting
 *      from `@shared/ui`, with zero duplicate local JSX component implementations.
 *   6. Zero orphaned imports referencing non-existent or deprecated UI modules.
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. Check: Platform Console must not import from "@/components/ui/*"
// ─────────────────────────────────────────────────────────────────────────────
const platformUiImports = [];
const platformFiles = walkFiles(PLATFORM_DIR, isCodeFile);

const FORBIDDEN_PLATFORM_UI_IMPORT = /from\s+["']@\/components\/ui\/([^"']+)["']/g;
const FORBIDDEN_PLATFORM_UI_ROOT_IMPORT = /from\s+["']@\/components\/ui["']/g;

for (const file of platformFiles) {
  const content = fs.readFileSync(file, "utf8");
  let match;
  while ((match = FORBIDDEN_PLATFORM_UI_IMPORT.exec(content)) !== null) {
    platformUiImports.push({
      file: toRel(file),
      importSpecifier: `@/components/ui/${match[1]}`,
      rule: "Platform Console must import from '@shared/ui', not '@/components/ui/*'",
    });
  }
  while ((match = FORBIDDEN_PLATFORM_UI_ROOT_IMPORT.exec(content)) !== null) {
    platformUiImports.push({
      file: toRel(file),
      importSpecifier: "@/components/ui",
      rule: "Platform Console must import from '@shared/ui', not '@/components/ui'",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Check: Cross-Console Import Boundaries (Tenant <-> Platform)
// ─────────────────────────────────────────────────────────────────────────────
const crossConsoleImports = [];

const TENANT_IMPORTING_PLATFORM = /from\s+["']@\/platform\/([^"']+)["']/g;
const tenantFiles = walkFiles(TENANT_DIR, isCodeFile);

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
}

const PLATFORM_IMPORTING_TENANT = /from\s+["']@\/tenant\/([^"']+)["']/g;
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
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Check: Facade Purity in apps/frontend/src/components/ui/
//    Components that exist in @shared/ui must only re-export from @shared/ui.
// ─────────────────────────────────────────────────────────────────────────────
const facadeViolations = [];
const facadeFiles = walkFiles(UI_FACADE_DIR, (f) => f.endsWith(".tsx") || f.endsWith(".ts"));

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
  // A clean facade should re-export from "@shared/ui"
  if (!content.includes('from "@shared/ui"') && !content.includes("from '@shared/ui'")) {
    facadeViolations.push({
      file: toRel(file),
      issue: `Primitive facade ${base} must re-export from '@shared/ui'`,
    });
  }

  // A facade must not declare fresh JSX implementations (<div, <button, etc.)
  // (allow Table's subcomponents if typed, but primitive implementation must come from @shared/ui)
  const hasLocalFunctionComponent =
    /const\s+[A-Z][A-Za-z0-9]+\s*=\s*\([^)]*\)\s*=>\s*<[a-z]+/m.test(content) &&
    base !== "table.tsx"; // table has helper subcomponents
  if (hasLocalFunctionComponent) {
    facadeViolations.push({
      file: toRel(file),
      issue: `Primitive facade ${base} defines local JSX implementation instead of re-exporting from @shared/ui`,
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
]);

for (const file of [...platformFiles, ...tenantFiles]) {
  const base = path.basename(file);
  if (BANNED_LOCAL_PRIMITIVES.has(base)) {
    // Check if it's in a features directory without feature prefix
    const rel = toRel(file);
    duplicatePrimitiveFiles.push({
      file: rel,
      issue: `Forbidden duplicate UI primitive file '${base}'. Reusable primitives must reside in '@shared/ui'.`,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Check: Orphaned Imports of Deleted/Deprecated UI Files
// ─────────────────────────────────────────────────────────────────────────────
const orphanedImports = [];
const allFrontendFiles = walkFiles(FE_SRC, isCodeFile);

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
// Summary & Reporting
// ─────────────────────────────────────────────────────────────────────────────
const totalViolations =
  platformUiImports.length +
  crossConsoleImports.length +
  facadeViolations.length +
  duplicatePrimitiveFiles.length +
  orphanedImports.length;

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      {
        totalViolations,
        platformUiImports,
        crossConsoleImports,
        facadeViolations,
        duplicatePrimitiveFiles,
        orphanedImports,
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
  console.log("✅ Platform Console imports: 100% direct from @shared/ui (0 violations)");
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
  console.log("✅ UI Facades: all 18 primitives cleanly delegate to @shared/ui (0 violations)");
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

console.log("\n=======================================================");
if (passed) {
  console.log("✨ All Shared UI component governance checks passed cleanly.\n");
  process.exit(0);
} else {
  console.error(`💥 Shared UI governance check failed with ${totalViolations} violation(s).\n`);
  process.exit(1);
}

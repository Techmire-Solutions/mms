#!/usr/bin/env node
/**
 * MMS Form Architecture Ratchet & Inventory.
 *
 * Two jobs:
 *
 *   1. INVENTORY (`--inventory`) — a deterministic manifest of every form surface in
 *      `apps/frontend/src` (FormModal consumers, raw modals, drawers, inline form files)
 *      with its lifecycle signals. Written to `docs/forms-inventory.md` and never
 *      hand-edited; a stale snapshot fails the gate.
 *
 *   2. RATCHET (default) — counts the form-contract regressions that a regex can prove,
 *      compares against `BASELINE`, and fails when the count grows. `--ratchet` fails
 *      when a baseline is HIGHER than reality (padding), mirroring the other ratchets.
 *
 * Advisory findings (copy/helper consistency) are printed but never fail; the form
 * static vitest guards own raw controls / index keys, and ESLint owns BiDi classes.
 *
 * Usage:
 *   node scripts/check-form-architecture.mjs                  # ratchet
 *   node scripts/check-form-architecture.mjs --changed        # changed files only
 *   node scripts/check-form-architecture.mjs --ratchet        # padding check
 *   node scripts/check-form-architecture.mjs --inventory      # write docs/forms-inventory.md
 *   node scripts/check-form-architecture.mjs --json           # machine-readable report
 *   node scripts/check-form-architecture.mjs --update-baselines
 *
 * Norms: mms-form-architecture.md §2, §3, §8.
 */

import fs from "node:fs";
import path from "node:path";

import { assertExemptionReasons, DIRTY_EXEMPT, SAVING_EXEMPT } from "./lib/form-exemptions.mjs";

assertExemptionReasons(SAVING_EXEMPT, "SAVING_EXEMPT");
assertExemptionReasons(DIRTY_EXEMPT, "DIRTY_EXEMPT");

const ROOT = process.cwd();
const FE_SRC = path.join(ROOT, "apps/frontend/src");
const INVENTORY = path.join(ROOT, "docs/forms-inventory.md");
const SELF = path.join(ROOT, "scripts/check-form-architecture.mjs");

/**
 * Only these counts are gated. They may only go DOWN.
 * Measured on the tree when the ratchet landed; regenerate with --json after a fix
 * wave and lower them in the same change (docs/forms-audit-<date>.md records why).
 */
const BASELINE = {
  formModalWithoutSaving: 0,
  formSurfaceWithoutInFlightBinding: 0,
  formModalWithoutDirtyGuard: 0,
  formSurfaceWithVoidMutate: 0,
  formSurfaceWithIndexKey: 0,
  inventoryDrift: 0,
};

const args = process.argv.slice(2);
const wantsInventory = args.includes("--inventory");
const wantsJson = args.includes("--json");
const wantsRatchet = args.includes("--ratchet");
const wantsChanged = args.includes("--changed");
const wantsUpdateBaselines = args.includes("--update-baselines");
const listIndex = args.indexOf("--list");
const listKey = listIndex >= 0 ? args[listIndex + 1] : null;

const toRel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

// ─────────────────────────────────────────────────────────────────────────────
// Discovery
// ─────────────────────────────────────────────────────────────────────────────

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage")
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (entry.name.endsWith(".tsx") && !/\.(test|spec)\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
}

const FORM_LIKE = /(Form|Modal|Drawer|Dialog)/;

/** Module owner for reporting: tenant feature, platform area, or shared component area. */
function moduleOf(rel) {
  const parts = rel.split("/");
  const at = parts.indexOf("features");
  if (parts[0] === "tenant" && at >= 0) return `tenant/${parts[at + 1]}`;
  if (parts[0] === "tenant" && parts[1] === "pages") return `tenant/pages/${parts[2]}`;
  if (parts[0] === "platform")
    return parts[1]?.endsWith(".tsx") ? "platform" : `platform/${parts[1]}`;
  if (parts[0] === "components") return `components/${parts[1]}`;
  if (parts[0] === "lib") return `lib/${parts[1]}`;
  return parts[0];
}

/** First `<FormModal` opening tag window — enough to see props without matching children. */
const FORM_MODAL_TAG = /<FormModal[\s>]/;

function tagWindow(source) {
  const match = FORM_MODAL_TAG.exec(source);
  if (!match) return "";
  return source.slice(match.index, match.index + 2500);
}

const INDEX_KEY = /key=\{(?:index|i|idx|rowIndex|optionIndex|sectionIndex)\}/;
const PHYSICAL_DIRECTION =
  /(?<![\w-])(?:pl|pr|ml|mr)-\d+|(?<![\w-])(?:text-left|text-right|border-l|border-r|rounded-l|rounded-r)(?![\w-])/g;

function analyze(rel, source) {
  const formModalWindow = tagWindow(source);
  const hasOnSave = /\bonSave=/.test(formModalWindow);
  const hasSaving = /\bsaving=/.test(formModalWindow);
  const hasDirtyGuard = /\bisDirty=/.test(formModalWindow);
  // "Guarded" = a synchronous guard hook, or a pending state bound to the shell's
  // `saving` prop (mutation isPending, or the form's own submitting/saving flag).
  // A form with no in-flight binding at all is the regression this gate catches.
  // In-flight binding = a pending state reaches the shell's `saving` prop, or a
  // canonical hook is used. This proves the UI cannot be clicked twice *after* a
  // re-render; it does NOT prove the synchronous guard rule §2 requires, which is
  // tracked separately as the advisory `synchronousGuard` signal.
  const inFlightBinding =
    /useFormSubmission|useSubmitGuard|useZodDraftForm/.test(source) ||
    /saving=\{[^}]*(?:isPending|submitting|isSaving|saving|closing|busy|inFlight)/i.test(source);
  const synchronousGuard =
    /useSubmitGuard|useFormSubmission|inFlightRef|sessionEntryIdRef|submitLock/.test(source);
  // A pending state only exists for an asynchronous save. Synchronous local
  // actions (close/preview/localStorage/prompt resolve) are exempt by declaration.
  // A dirty guard only has meaning when the surface owns an editable draft.
  // Confirmation / credential / destructive dialogs have no draft to preserve.
  const hasEditableDraft =
    /<(?:Input|Textarea|FormSelect|EditableSelect|DatePicker|TimePicker|DateTimePicker|ContactPicker|FormCollectionShell|Checkbox|FormSelectWithQuickCreate)\b/.test(
      source,
    );
  const asyncWrite =
    /mutateAsync\s*\(|\.mutate\s*\(|await\s+onSave|await\s+onPersist|onCitationsChange\s*\(|await\s+save/i.test(
      source,
    );
  const isFormModal = formModalWindow.length > 0;
  // A file can render more than one shell (e.g. two specialized-entry modals). The
  // recorded signals inspect the first tag; the tag count keeps the metric honest.
  const formModalTags = (source.match(/<FormModal[\s>]/g) ?? []).length;
  const isRawModal = !isFormModal && /<Modal[\s>]/.test(source);
  const isDrawer = /DetailSheet|DetailDrawerShell|Drawer/.test(source);
  const surfaceType = isFormModal
    ? "modal-form"
    : isRawModal
      ? "modal"
      : isDrawer
        ? "drawer"
        : "inline";

  const signals = {
    module: moduleOf(rel),
    file: rel,
    surfaceType,
    formModalTags,
    saving: hasSaving,
    dirtyGuard: hasDirtyGuard,
    inFlightBinding,
    synchronousGuard,
    identityReset: /useIdentityReset|resetDraft/.test(source),
    serverErrorMap: /mapApiFormError|onFieldErrors/.test(source),
    zodMap: /mapZodFormErrors/.test(source),
    dirtySnapshot: /useDirtySnapshot/.test(source),
    stableRows: /useStableRowList/.test(source),
    invalidates: /invalidateQueries|invalidate[A-Z]\w*Queries/.test(source),
    voidMutate: /void\s+[\w.]*\.mutate\s*\(/.test(source),
    // Only stateful repeatable rows: a static error-list map keyed by index cannot
    // corrupt input state, and the formCollectionKeys guard scopes the same way.
    indexKey: /FormListFieldCard|useStableRowList/.test(source) && INDEX_KEY.test(source),
    rawControls: (source.match(/<(input|select|textarea)\b/g) ?? []).length,
    physicalDirection: (source.match(PHYSICAL_DIRECTION) ?? []).length,
    literalPlaceholder: /placeholder="[A-Za-z]/.test(source),
    literalAriaLabel: /aria-label="[A-Za-z]/.test(source),
    formErrorBannerManual:
      isFormModal && /<FormErrorBanner[\s>]/.test(source) && !/FormModal\.Error/.test(source),
  };

  return {
    ...signals,
    isFormModal,
    writeSurface: isFormModal && hasOnSave,
    counts: {
      formModalWithoutSaving:
        isFormModal && hasOnSave && !hasSaving && !SAVING_EXEMPT.has(rel) ? 1 : 0,
      formSurfaceWithoutInFlightBinding:
        isFormModal && hasOnSave && asyncWrite && !inFlightBinding ? 1 : 0,
      formModalWithoutDirtyGuard:
        isFormModal && hasOnSave && hasEditableDraft && !hasDirtyGuard && !DIRTY_EXEMPT.has(rel)
          ? 1
          : 0,
      formSurfaceWithVoidMutate: signals.voidMutate ? 1 : 0,
      formSurfaceWithIndexKey: signals.indexKey ? 1 : 0,
    },
  };
}

const allFiles = walkFiles(FE_SRC);
const formFiles = allFiles
  .map((file) => ({
    file,
    rel: toRel(file).replace(/^apps\/frontend\/src\//, ""),
    source: fs.readFileSync(file, "utf8"),
  }))
  .filter(({ rel, source }) => {
    // Shared form primitives own the native elements they render; they are not consumers.
    if (/^components\/app\/Form[A-Z]/.test(rel)) return false;
    // A consumer can live in a file whose name does not mention Form/Modal, so the
    // tag itself qualifies a surface; the name filter keeps drawers/inline forms.
    return FORM_LIKE.test(path.basename(rel)) || FORM_MODAL_TAG.test(source);
  });

const entries = formFiles
  .map(({ rel, source }) => analyze(rel, source))
  .sort((a, b) => a.file.localeCompare(b.file));

// ─────────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────────

const measured = {
  formModalWithoutSaving: 0,
  formSurfaceWithoutInFlightBinding: 0,
  formModalWithoutDirtyGuard: 0,
  formSurfaceWithVoidMutate: 0,
  formSurfaceWithIndexKey: 0,
  inventoryDrift: 0,
};
for (const entry of entries) {
  for (const key of Object.keys(measured)) measured[key] += entry.counts[key] ?? 0;
}

const modalSurfaces = entries.filter((entry) => entry.isFormModal);
const modalTags = entries.reduce((sum, entry) => sum + entry.formModalTags, 0);
const writeSurfaces = entries.filter((entry) => entry.writeSurface);

function renderInventory() {
  const lines = [];
  lines.push("# Form Inventory");
  lines.push("");
  lines.push(
    "Generated by `pnpm run forms:inventory` (`scripts/check-form-architecture.mjs --inventory`).",
  );
  lines.push("Do not edit by hand: the ratchet fails when this file is stale.");
  lines.push("");
  lines.push(
    `Totals: **${entries.length}** form-like \`.tsx\` files · **${modalSurfaces.length}** files with a \`<FormModal>\` (**${modalTags}** tags) · **${writeSurfaces.length}** write surfaces.`,
  );
  lines.push("");

  const modules = [...new Set(entries.map((entry) => entry.module))].sort();
  lines.push("## Coverage by module");
  lines.push("");
  lines.push(
    "| Module | Form surfaces | Write surfaces | Guarded submit | Dirty guard | Server-error map |",
  );
  lines.push("|---|---:|---:|---:|---:|---:|");
  for (const module of modules) {
    const inModule = entries.filter((entry) => entry.module === module);
    const writes = inModule.filter((entry) => entry.writeSurface);
    lines.push(
      `| ${module} | ${inModule.length} | ${writes.length} | ${
        writes.filter((entry) => entry.inFlightBinding).length
      } | ${writes.filter((entry) => entry.dirtyGuard).length} | ${
        inModule.filter((entry) => entry.serverErrorMap).length
      } |`,
    );
  }
  lines.push("");
  lines.push("## FormModal surfaces");
  lines.push("");
  lines.push(
    "| File | Module | Surface | saving | dirty | guarded submit | identity reset | server map |",
  );
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const entry of modalSurfaces) {
    lines.push(
      `| \`${entry.file}\` | ${entry.module} | ${entry.surfaceType} | ${entry.counts.formModalWithoutSaving ? "missing" : "ok"} | ${
        entry.counts.formModalWithoutDirtyGuard ? "missing" : "ok"
      } | ${entry.inFlightBinding ? "ok" : "missing"} | ${entry.identityReset ? "ok" : "—"} | ${
        entry.serverErrorMap ? "ok" : "—"
      } |`,
    );
  }
  lines.push("");
  lines.push("## Other form-like components");
  lines.push("");
  lines.push("| File | Module | Surface | Raw controls |");
  lines.push("|---|---|---|---:|");
  for (const entry of entries.filter((entry) => !entry.isFormModal)) {
    lines.push(
      `| \`${entry.file}\` | ${entry.module} | ${entry.surfaceType} | ${entry.rawControls} |`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

const rendered = renderInventory();
let drift = false;
if (fs.existsSync(INVENTORY)) {
  // Windows checkouts (core.autocrlf) hold the committed inventory with CRLF line
  // endings; compare on LF so the same file is not reported as drift there.
  drift = fs.readFileSync(INVENTORY, "utf8").replace(/\r\n/g, "\n") !== rendered;
} else {
  drift = true;
}
if (drift) measured.inventoryDrift = 1;

// Advisory findings: printed, never gated (regex cannot prove behaviour).
const advisory = {
  // These pass the in-flight binding gate but have no synchronous re-entry guard in
  // this file (the guard may live in an owning hook — verify before changing).
  synchronousGuardMissing: writeSurfaces
    .filter((entry) => !entry.synchronousGuard)
    .map((entry) => entry.file),
  voidMutate: entries.filter((entry) => entry.voidMutate).map((entry) => entry.file),
  indexKey: entries.filter((entry) => entry.indexKey).map((entry) => entry.file),
  physicalDirection: entries
    .filter((entry) => entry.physicalDirection > 0)
    .map((entry) => `${entry.file} (${entry.physicalDirection})`),
  literalCopy: entries
    .filter((entry) => entry.literalPlaceholder || entry.literalAriaLabel)
    .map((entry) => entry.file),
  manualErrorBanner: entries
    .filter((entry) => entry.formErrorBannerManual)
    .map((entry) => entry.file),
};

if (wantsInventory) {
  fs.mkdirSync(path.dirname(INVENTORY), { recursive: true });
  fs.writeFileSync(INVENTORY, rendered, "utf8");
  console.log(`✓ wrote ${toRel(INVENTORY)} (${entries.length} form-like files)`);
  process.exit(0);
}

if (listKey) {
  const rows = entries.filter((entry) => entry.counts[listKey] === 1);
  console.log(`${listKey}: ${rows.length}`);
  for (const row of rows) console.log(`  ${row.file}  [${row.module}]`);
  process.exit(0);
}

if (wantsUpdateBaselines) {
  const source = fs.readFileSync(SELF, "utf8");
  const block = Object.entries(measured)
    .filter(([key]) => key in BASELINE)
    .map(([key, value]) => `  ${key}: ${value},`)
    .join("\n");
  const updated = source.replace(
    /const BASELINE = \{[\s\S]*?\n\};/,
    `const BASELINE = {\n${block}\n};`,
  );
  fs.writeFileSync(SELF, updated, "utf8");
  console.log(`✓ baselines updated: ${JSON.stringify(measured)}`);
  process.exit(0);
}

if (wantsJson) {
  console.log(
    JSON.stringify(
      {
        totals: {
          formLike: entries.length,
          filesWithFormModal: modalSurfaces.length,
          formModalTags: modalTags,
          writeSurfaces: writeSurfaces.length,
        },
        measured,
        baseline: BASELINE,
        advisory,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (wantsChanged) {
  const { changeBase, changedFiles, readAtBase, readCurrent } =
    await import("./lib/changed-files.mjs");
  const regressions = [];
  for (const rel of changedFiles()) {
    if (!rel.startsWith("apps/frontend/src/") || !/\.tsx$/.test(rel)) continue;
    const current = readCurrent(rel);
    if (current === null) continue;
    const short = rel.replace(/^apps\/frontend\/src\//, "");
    const now = analyze(short, current);
    const base = analyze(short, readAtBase(rel) ?? "");
    for (const key of Object.keys(measured)) {
      if (key === "inventoryDrift") continue;
      if ((now.counts[key] ?? 0) > (base.counts[key] ?? 0)) {
        regressions.push(`${key}: ${short} gained a violation (vs ${changeBase.slice(0, 9)})`);
      }
    }
  }
  if (drift && !changedFiles().includes("docs/forms-inventory.md")) {
    console.log("ℹ️  docs/forms-inventory.md is stale (run pnpm run forms:inventory)");
  }
  if (regressions.length > 0) {
    for (const regression of regressions) console.error(`✗ ${regression}`);
    console.error("\n💥 Form-contract regression in changed files.");
    process.exit(1);
  }
  console.log("✅ No form-contract regression in changed files.");
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate
// ─────────────────────────────────────────────────────────────────────────────

let failed = false;
if (wantsRatchet) {
  for (const [key, value] of Object.entries(BASELINE)) {
    if (measured[key] < value) {
      console.error(
        `❌ BASELINE.${key} is ${value} but measured ${measured[key]} — lower it (padding hides regressions).`,
      );
      failed = true;
    } else if (measured[key] > value) {
      console.error(
        `❌ BASELINE.${key} is ${value} but measured ${measured[key]} — a regression; fix it or the default gate fails.`,
      );
      failed = true;
    }
  }
  if (!failed)
    console.log("✅ Form baselines equal the measured counts (no padding, no regression).");
  process.exit(failed ? 1 : 0);
}

console.log("=== MMS Form Architecture Ratchet ===");
console.log(
  `Scanned ${allFiles.length} frontend TSX files · ${entries.length} form-like · ${modalSurfaces.length} files with FormModal (${modalTags} tags)\n`,
);

for (const key of Object.keys(BASELINE)) {
  const value = measured[key];
  const baseline = BASELINE[key];
  if (value > baseline) {
    failed = true;
    console.error(`❌ ${key}: ${value} (baseline ${baseline})`);
    const offenders =
      key === "inventoryDrift"
        ? ["docs/forms-inventory.md"]
        : entries.filter((entry) => entry.counts[key] === 1).map((entry) => entry.file);
    for (const offender of offenders.slice(0, 10)) console.error(`   - ${offender}`);
    if (offenders.length > 10) console.error(`   … ${offenders.length - 10} more`);
  } else {
    console.log(`✅ ${key}: ${value}/${baseline}`);
  }
}

const advisoryEntries = Object.entries(advisory).filter(([, list]) => list.length > 0);
if (advisoryEntries.length > 0) {
  console.log("\nℹ️  Advisory (review, does not fail):");
  for (const [key, list] of advisoryEntries) {
    console.log(`   ${key}: ${list.length}`);
    for (const item of list.slice(0, 5)) console.log(`     - ${item}`);
  }
}

console.log("");
if (failed) {
  console.error("💥 Form architecture ratchet failed. See mms-form-architecture.md §2, §3, §8.");
  process.exit(1);
}
console.log("✨ Form architecture ratchet clean.");

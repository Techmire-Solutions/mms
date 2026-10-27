#!/usr/bin/env node
/**
 * i18n unused-key ratchet.
 *
 * `check-translations.ts` proves the four locale packs are *complete* — same keys
 * everywhere, no English fallbacks. Nothing proved the opposite direction: that a
 * key is actually reachable from the UI. With ~9.4k keys across four files that
 * every feature commit touches, dead keys accumulate silently and are then
 * translated four times over.
 *
 * A key counts as used when
 *   - the exact key appears as a string literal anywhere in app/e2e source, or
 *   - it starts with the static prefix of a template literal (`t(\`mod.${x}\`)`).
 *
 * The second rule is deliberately conservative (a prefix marks every key under it
 * as used), so the reported number is a LOWER bound on dead keys — which is what
 * a ratchet wants: it must never fire on a key that might be used dynamically.
 *
 *   node scripts/i18n/check-unused-keys.mjs            # report + ratchet
 *   node scripts/i18n/check-unused-keys.mjs --list     # print every unused key
 *   node scripts/i18n/check-unused-keys.mjs --update-baseline
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EN_PACK = path.join(ROOT, "packages/shared/src/i18n/appTranslationsEn.ts");

/** Measured when the ratchet landed. Only ever lower this. */
const BASELINE = 518;

const SCAN_ROOTS = [
  "apps/backend/src",
  "apps/frontend/src",
  "packages/ui/src",
  "packages/shared/src", // excluding the translation packs themselves
  "e2e/tests",
  "e2e/helpers",
];

function listSourceFiles() {
  const files = [];
  for (const root of SCAN_ROOTS) {
    const full = path.join(ROOT, root);
    if (!fs.existsSync(full)) continue;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const next = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (["node_modules", "dist", ".turbo", "coverage"].includes(entry.name)) continue;
          walk(next);
          continue;
        }
        if (!/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;
        if (next.includes("/i18n/appTranslations")) continue;
        files.push(next);
      }
    };
    walk(full);
  }
  return files;
}

function readKeys() {
  const content = fs.readFileSync(EN_PACK, "utf8");
  const keys = [];
  for (const match of content.matchAll(/^\s{2}"([^"\n]+)":/gm)) keys.push(match[1]);
  return keys;
}

const STRING_LITERAL = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;

function collectUsage(files) {
  const literals = new Set();
  const templatePrefixes = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const match of content.matchAll(STRING_LITERAL)) {
      const value = match[2];
      literals.add(value);
      // `...${` inside a template literal: every key under the prefix is
      // potentially reachable, so treat the static prefix as covering them.
      if (match[1] === "`" && value.includes("${")) {
        const prefix = value.slice(0, value.indexOf("${"));
        if (prefix.length > 0) templatePrefixes.push(prefix);
      }
    }
  }
  return { literals, templatePrefixes };
}

const keys = readKeys();
const files = listSourceFiles();
const { literals, templatePrefixes } = collectUsage(files);

const unused = keys.filter(
  (key) => !literals.has(key) && !templatePrefixes.some((prefix) => key.startsWith(prefix)),
);

const total = keys.length;
const percent = total === 0 ? 0 : (unused.length / total) * 100;

console.log(`i18n keys in en pack: ${total}`);
console.log(
  `Unreferenced keys: ${unused.length} (${percent.toFixed(1)}%) — baseline ${BASELINE}, scanned ${files.length} files`,
);

if (process.argv.includes("--list")) {
  for (const key of unused) console.log(key);
}

if (process.argv.includes("--update-baseline")) {
  if (unused.length < BASELINE) {
    const scriptPath = path.join(ROOT, "scripts/i18n/check-unused-keys.mjs");
    const content = fs.readFileSync(scriptPath, "utf8");
    fs.writeFileSync(
      scriptPath,
      content.replace(/const BASELINE = \d+;/, `const BASELINE = ${unused.length};`),
      "utf8",
    );
    console.log(`✅ Baseline ratcheted down to ${unused.length}.`);
  } else {
    console.log("ℹ️ No baseline improvement to record.");
  }
  process.exit(0);
}

if (unused.length > BASELINE) {
  console.error(
    `\n✗ ${unused.length - BASELINE} new unreferenced translation key(s). ` +
      "Remove the key from all four locale packs, or wire it up — do not raise the baseline.",
  );
  console.error("Run with --list to see them.");
  process.exit(1);
}

if (unused.length < BASELINE) {
  console.log(
    `\n🎉 ${BASELINE - unused.length} key(s) better than baseline. Run with --update-baseline to ratchet.`,
  );
}

console.log("\n✓ i18n unused-key ratchet held.");

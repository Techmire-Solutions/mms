#!/usr/bin/env node
/**
 * Money-safety ratchet for Finance/Accounting.
 *
 * A float ever touching a money value is a silent rounding bug: `parseFloat` on a
 * decimal string loses cents beyond 2^53, and an unchecked `Number()` hides the day
 * a numeric column is widened past safe integer cents. DB adapters are the one
 * permitted conversion point, and `db-integration/financeEnumParityDb` proves every
 * 2-dp column stays inside Number-safe cents.
 *
 * Tests and generated output are skipped. Findings fail the build.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = [
  "packages/shared/src/finance",
  "packages/shared/src/money",
  "apps/backend/src/finance",
  "apps/backend/src/accounting",
  "apps/backend/src/db/repositories",
  "apps/frontend/src/lib/data",
  // The template/receipt renderers format money for print; they were outside every scan root
  // (audit S5).
  "apps/frontend/src/lib",
  "apps/frontend/src/tenant/features/finance",
  "apps/frontend/src/tenant/features/accounting",
  "apps/frontend/src/tenant/features/obligations",
];
const SOURCE_EXT = /\.(ts|tsx)$/;
const SKIP = /(?:^|\/)(?:__tests__|dist|node_modules)\/|\.(?:test|spec)\.(?:ts|tsx)$/;

const FINDINGS = [];
const ALLOW = [
  {
    file: /^apps\/backend\/src\/db\/repositories\//,
    rule: "db-adapter",
    reason: "exact only for the 2-dp column precisions asserted by financeEnumParityDb",
  },
  {
    file: /^apps\/frontend\/src\/tenant\/features\/finance\/lib\/paymentFormHelpers\.ts$/,
    rule: "db-adapter",
    reason: "form draft is validated by DECIMAL_MONEY_REGEX before conversion",
  },
];

const MONEY_ARG =
  /(?:amount|debit|credit|balance|fee|paid|credited|late|total|opening|closing|rate)/i;

function isAllowed(file, rule) {
  return ALLOW.some((entry) => entry.rule === rule && entry.file.test(file));
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "__tests__") {
        continue;
      }
      walk(full, files);
    } else if (SOURCE_EXT.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const NON_MONEY_ARG = /(?:Cents|Minor|Percent|Count|Index|Length|Digits|Sequence|Date|Days)/;

for (const scanDir of SCAN_DIRS) {
  for (const file of walk(path.join(ROOT, scanDir))) {
    const relative = path.relative(ROOT, file).split(path.sep).join("/");
    if (SKIP.test(relative)) continue;
    // The repository layer is shared infrastructure; only its finance/accounting
    // files are in scope for this ratchet (other modules' `any` is not ours).
    if (
      relative.startsWith("apps/backend/src/db/repositories/") &&
      !/(?:finance|accounting|obligation)/i.test(relative)
    ) {
      continue;
    }
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      const where = `${relative}:${index + 1}`;
      const trimmed = line.trim();
      if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
        return;
      }
      if (/\bparseFloat\s*\(/.test(line) && !isAllowed(relative, "parse-float")) {
        FINDINGS.push(
          `${where} parseFloat() — parse the decimal string exactly (parseMoney/minor units)`,
        );
      }
      const numberMatch = line.match(/(?<![.\w])Number\s*\(\s*([^)]*)/);
      const numberArg = numberMatch?.[1] ?? "";
      if (
        numberMatch &&
        MONEY_ARG.test(numberArg) &&
        !NON_MONEY_ARG.test(numberArg) &&
        !isAllowed(relative, "db-adapter")
      ) {
        FINDINGS.push(`${where} Number() on a money value — convert via integer cents`);
      }
      if (/:\s*any\b|\bas\s+any\b/.test(line) && !isAllowed(relative, "any-cast")) {
        FINDINGS.push(`${where} any cast in finance code`);
      }
    });
  }
}

if (FINDINGS.length > 0) {
  console.error("✗ Money-safety ratchet failed:");
  for (const finding of FINDINGS.slice(0, 40)) console.error(`   ${finding}`);
  if (FINDINGS.length > 40) console.error(`   …and ${FINDINGS.length - 40} more`);
  process.exit(1);
}
console.log(
  `✓ No float money coercions or any casts in ${SCAN_DIRS.length} finance/accounting roots.`,
);

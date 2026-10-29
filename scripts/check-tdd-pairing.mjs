#!/usr/bin/env node
/**
 * Advisory TDD pairing reminder (mms-tdd §2).
 *
 * Flags backend domain files (use-cases / services / repositories) that changed
 * without a changed Vitest spec in the same module. It cannot prove test-first
 * ordering — it only makes a missing test visible before the PR opens, which is
 * why it never fails the build unless `--strict` is passed.
 *
 *   node scripts/check-tdd-pairing.mjs
 *   node scripts/check-tdd-pairing.mjs --strict
 *   node scripts/check-tdd-pairing.mjs --base main
 *
 * Env: MMS_CI_BASE (set by scripts/ci/local-ci.sh) is used when --base is absent.
 * Base resolution mirrors scripts/ci/local-ci.sh: explicit ref → MMS_CI_BASE →
 * origin/main → main → master → HEAD~1. With no resolvable base (shallow clone,
 * initial commit) the check reports "skipped" instead of a false "no domain files".
 */
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const baseFlag = argv.indexOf("--base");
const explicitBase = baseFlag >= 0 ? argv[baseFlag + 1] : process.env.MMS_CI_BASE;
const STRICT = argv.includes("--strict");

const DOMAIN_RE = /^apps\/backend\/src\/.+\/(?:use-cases|services|repositories|repository)\//;
const TEST_RE = /\.(?:integration\.)?test\.(?:ts|tsx)$/;

const git = (args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const resolveBase = () => {
  if (explicitBase && git(["rev-parse", "--verify", "--quiet", explicitBase]).length === 0) {
    console.warn(
      `TDD pairing (advisory): base '${explicitBase}' not found — falling back to origin/main / HEAD~1.`,
    );
  }
  const candidates = explicitBase ? [explicitBase] : ["origin/main", "main", "master"];
  for (const ref of candidates) {
    const mergeBase = git(["merge-base", "HEAD", ref])[0];
    if (mergeBase) return mergeBase;
  }
  return git(["rev-parse", "HEAD~1"])[0] ?? null;
};

const base = resolveBase();
if (!base) {
  console.log("TDD pairing (advisory): skipped — no base ref (shallow clone or initial commit).");
  process.exit(0);
}

const changed = new Set([
  ...git(["diff", "--name-only", "--diff-filter=ACMR", base]),
  ...git(["diff", "--name-only", "HEAD"]),
  ...git(["ls-files", "--others", "--exclude-standard"]),
]);

const isTest = (file) => TEST_RE.test(file) || file.endsWith(".spec.ts");
const changedTests = [...changed].filter(isTest);
const domainFiles = [...changed].filter(
  (file) => DOMAIN_RE.test(file) && file.endsWith(".ts") && !isTest(file),
);

/** First four path segments: `apps/backend/src/<module>`. */
const moduleOf = (file) => file.split("/").slice(0, 4).join("/");
const basenameOf = (file) =>
  file
    .split("/")
    .pop()
    .replace(/\.(?:integration\.)?test\.(?:ts|tsx)$/, "")
    .replace(/\.ts$/, "");

const unpaired = domainFiles.filter((src) => {
  const module = moduleOf(src);
  const name = basenameOf(src);
  return !changedTests.some(
    (test) =>
      moduleOf(test) === module ||
      basenameOf(test) === name ||
      basenameOf(test).startsWith(`${name}.`) ||
      test.includes(`/${name}.test`),
  );
});

if (domainFiles.length === 0) {
  console.log("✓ TDD pairing (advisory): no backend domain files in the change set.");
  process.exit(0);
}

if (unpaired.length === 0) {
  console.log(
    `✓ TDD pairing (advisory): ${domainFiles.length} domain file(s), ${changedTests.length} spec(s) changed.`,
  );
  process.exit(0);
}

console.warn(
  `⚠️  TDD pairing (advisory): ${unpaired.length} changed backend domain file(s) without a changed spec:`,
);
for (const file of unpaired) console.warn(`   - ${file}`);
console.warn(
  "   Write the failing spec first and record the Red evidence in the PR body (rule mms-tdd §1).",
);
process.exit(STRICT ? 1 : 0);

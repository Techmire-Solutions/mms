#!/usr/bin/env node
/**
 * Pre-commit secret scanning guard for staged files.
 *
 * Checks staged files against sensitive file patterns and token heuristics.
 * If `gitleaks` is installed locally, invokes `gitleaks protect --staged`.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

// Large merges stage far more than the 1 MiB default buffer.
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 30 });

// 1. Get list of staged files
let stagedFiles = [];
try {
  const output = git("diff", "--cached", "--name-only").trim();
  if (output) {
    stagedFiles = output.split("\n").filter(Boolean);
  }
} catch {
  // Not a git repo or git error
  process.exit(0);
}

if (stagedFiles.length === 0) {
  process.exit(0);
}

// 2. Block sensitive filenames
const BANNED_FILE_PATTERNS = [
  /^\.env(\.[^.]+)?$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /\.(pem|key|p12|pfx|kdbx)$/i,
  /service-account.*\.json$/i,
  /oauth_creds\.json$/i,
];

const ALLOWED_FILES = new Set([
  ".env.example",
  "apps/backend/.env.example",
  "apps/frontend/.env.example",
]);

let violations = [];

for (const file of stagedFiles) {
  if (ALLOWED_FILES.has(file)) continue;
  for (const pattern of BANNED_FILE_PATTERNS) {
    if (pattern.test(file)) {
      violations.push(`Blocked sensitive file pattern: ${file}`);
    }
  }
}

// 3. If gitleaks is available, delegate deep scanning to gitleaks
let hasGitleaks = false;
try {
  execFileSync("gitleaks", ["version"], { stdio: "ignore" });
  hasGitleaks = true;
} catch {
  hasGitleaks = false;
}

if (hasGitleaks) {
  try {
    execFileSync("gitleaks", ["protect", "--staged", "--no-banner"], { stdio: "inherit" });
  } catch {
    violations.push("gitleaks detected sensitive credentials in staged diff.");
  }
} else {
  // 4. Fallback heuristic scan on staged diff
  try {
    const diff = git("diff", "--cached");
    const SECRET_PATTERNS = [
      { name: "Private Key Block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
      { name: "AWS Access Key ID", regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/ },
      { name: "GitHub Personal Access Token", regex: /\bgh[pousr]_[A-Za-z0-9_]{36,255}\b/ },
      { name: "Slack Token", regex: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/ },
      { name: "Stripe Secret Key", regex: /\b(sk|rk)_(live|test)_[0-9a-zA-Z]{24,99}\b/ },
    ];

    for (const { name, regex } of SECRET_PATTERNS) {
      if (regex.test(diff)) {
        violations.push(`Detected potential credential: ${name}`);
      }
    }
  } catch (err) {
    violations.push(
      `Could not inspect staged diff (${err.message}); refusing to pass unscanned changes.`,
    );
  }
}

if (violations.length > 0) {
  console.error("\n🚨 [SECRET SCANNER BLOCKED COMMIT]");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  console.error("\nPlease remove sensitive credentials before committing.\n");
  process.exit(1);
}

console.log("🔒 Staged secret check passed.");
process.exit(0);

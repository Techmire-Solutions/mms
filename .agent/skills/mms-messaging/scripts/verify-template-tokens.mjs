#!/usr/bin/env node
/**
 * Verify messaging template personalization tokens against the runtime allowlist.
 *
 * This used to print a green banner without reading anything: it resolved a
 * non-existent `packages/contracts/src/messagingSchemas.ts`, kept a hardcoded copy of
 * the token list (stale and different from the runtime set), and always exited 0.
 * A gate that cannot fail is worse than no gate.
 *
 * What it proves now:
 *   1. The allowlist is read from its single source of truth
 *      (`packages/contracts/src/messaging/messagingPersonalizeUtils.ts`), so a drifted
 *      copy cannot pass.
 *   2. Every shipped default template (`DEFAULT_MESSAGE_TEMPLATES`) uses only
 *      allowlisted tokens.
 *   3. Any `--text "<body>"` / `--file <path>` argument validates the same way.
 *
 * Usage:
 *   node .agent/skills/mms-messaging/scripts/verify-template-tokens.mjs
 *   node .agent/skills/mms-messaging/scripts/verify-template-tokens.mjs --text "Hi {name}"
 *   node .agent/skills/mms-messaging/scripts/verify-template-tokens.mjs --file template.txt
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const ALLOWLIST_SOURCE = resolve(ROOT, "packages/contracts/src/messaging/messagingPersonalizeUtils.ts");
const DEFAULTS_SOURCE = resolve(ROOT, "packages/contracts/src/messaging/messagingTemplateSchemas.ts");

const TOKEN_PATTERN = /\{([^}]*)\}/g;
const failures = [];

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_SOURCE)) {
    failures.push(`allowlist source missing: ${ALLOWLIST_SOURCE}`);
    return new Set();
  }
  const source = readFileSync(ALLOWLIST_SOURCE, "utf8");
  const block = /ALLOWED_PERSONALIZATION_TOKEN_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(source);
  if (!block) {
    failures.push("ALLOWED_PERSONALIZATION_TOKEN_KEYS not found — did the declaration move?");
    return new Set();
  }
  const keys = [...block[1].matchAll(/"([a-z0-9_]+)"/g)].map((match) => match[1]);
  if (keys.length === 0) failures.push("allowlist parsed empty — refusing to validate against nothing");
  return new Set(keys);
}

/** Token key = text before `|`, trimmed and lowercased (`{name|Valued Parent}` → `name`). */
function tokensIn(body) {
  return [...body.matchAll(TOKEN_PATTERN)]
    .map((match) => String(match[1] ?? "").split("|")[0].trim().toLowerCase())
    .filter(Boolean);
}

function check(label, body, allowlist) {
  const unknown = [...new Set(tokensIn(body).filter((token) => !allowlist.has(token)))];
  if (unknown.length > 0) failures.push(`${label}: unknown token(s) ${unknown.map((t) => `{${t}}`).join(", ")}`);
  return tokensIn(body).length;
}

function loadDefaultTemplates() {
  if (!existsSync(DEFAULTS_SOURCE)) {
    failures.push(`default templates source missing: ${DEFAULTS_SOURCE}`);
    return [];
  }
  const source = readFileSync(DEFAULTS_SOURCE, "utf8");
  return [...source.matchAll(/id:\s*"([^"]+)"[\s\S]*?body:\s*"((?:[^"\\]|\\.)*)"/g)].map((match) => ({
    id: match[1],
    body: match[2].replace(/\\"/g, '"'),
  }));
}

const args = process.argv.slice(2);
const allowlist = loadAllowlist();
const templates = loadDefaultTemplates();

let checkedTokens = 0;
for (const template of templates) checkedTokens += check(`default template ${template.id}`, template.body, allowlist);

for (let index = 0; index < args.length; index += 1) {
  const flag = args[index];
  const value = args[index + 1];
  if (flag === "--text" && value) {
    checkedTokens += check("--text", value, allowlist);
    index += 1;
  } else if ((flag === "--text" || flag === "--file") && !value) {
    failures.push(`${flag} needs a value`);
  } else if (flag === "--file" && value) {
    const file = resolve(ROOT, value);
    if (!existsSync(file)) {
      failures.push(`--file not found: ${value}`);
      continue;
    }
    checkedTokens += check(value, readFileSync(file, "utf8"), allowlist);
    index += 1;
  }
}

console.log(
  `Checked ${templates.length} default template(s) and ${checkedTokens} token(s) against ${allowlist.size} allowlisted keys.`,
);

if (failures.length > 0) {
  for (const failure of failures) console.error(`❌ ${failure}`);
  console.error("\n💥 Template token verification failed (mms-messaging.md §3).");
  process.exit(1);
}

console.log("✅ All template tokens are allowlisted.");

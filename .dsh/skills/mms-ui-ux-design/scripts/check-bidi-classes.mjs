#!/usr/bin/env node
/**
 * Fast, dependency-free BiDi sweep over class strings.
 *
 * Scope note: this defaults to the WHOLE frontend source tree, not just
 * `src/components`. It used to default to `src/components` (404 files of 1,941),
 * which meant `tenant/features/**` — where the modules actually live — was never
 * checked, yet the command still printed a green "all files adhere" line. A guard
 * that reports success on the part of the tree it skipped is worse than no guard.
 *
 * ESLint (`mms-bidi/no-physical-directional-classes`) remains the authoritative
 * gate: it understands AST context and now also reads class-composer calls like
 * `cn(...)`. This script exists so the check can run without a lint toolchain — it
 * is a text scan, so it also sees class strings held in plain `.ts` files, which
 * the ESLint rule's `className` visitor does not.
 *
 * Usage: node check-bidi-classes.mjs [path]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

/**
 * A match must be a whole utility token, so the lookbehind/lookahead exclude
 * longer hyphen-joined utilities. Without them `rounded-l` matched inside
 * `rounded-lg`, and `right-2` matched inside `slide-in-from-right-2` (a Radix
 * enter animation, which is legitimately physical).
 */
const TOKEN_START = '(?<![\\w-])';
const TOKEN_END = '(?![\\w-])';

const BANNED_PATTERNS = [
  { regex: new RegExp(`${TOKEN_START}pl-\\d+${TOKEN_END}`, 'g'), replacement: 'ps-*' },
  { regex: new RegExp(`${TOKEN_START}pr-\\d+${TOKEN_END}`, 'g'), replacement: 'pe-*' },
  { regex: new RegExp(`${TOKEN_START}ml-\\d+${TOKEN_END}`, 'g'), replacement: 'ms-*' },
  { regex: new RegExp(`${TOKEN_START}mr-\\d+${TOKEN_END}`, 'g'), replacement: 'me-*' },
  { regex: new RegExp(`${TOKEN_START}text-left${TOKEN_END}`, 'g'), replacement: 'text-start' },
  { regex: new RegExp(`${TOKEN_START}text-right${TOKEN_END}`, 'g'), replacement: 'text-end' },
  {
    regex: new RegExp(`${TOKEN_START}border-l(-[\\w./]+)?${TOKEN_END}`, 'g'),
    replacement: 'border-s-*',
  },
  {
    regex: new RegExp(`${TOKEN_START}border-r(-[\\w./]+)?${TOKEN_END}`, 'g'),
    replacement: 'border-e-*',
  },
  {
    regex: new RegExp(`${TOKEN_START}rounded-l(-[\\w./]+)?${TOKEN_END}`, 'g'),
    replacement: 'rounded-s-*',
  },
  {
    regex: new RegExp(`${TOKEN_START}rounded-r(-[\\w./]+)?${TOKEN_END}`, 'g'),
    replacement: 'rounded-e-*',
  },
  {
    // Physical inset positioning. Variant prefixes (`md:`, `hover:`) are fine.
    regex: new RegExp(`${TOKEN_START}(?:after:|before:)?(?:left|right)-\\d+${TOKEN_END}`, 'g'),
    replacement: 'start-*/end-* (inset-inline-start/end)',
  },
];

const SCANNED_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js', '.html'];

function scanPath(targetPath, fileList = []) {
  const stat = statSync(targetPath);
  if (!stat.isDirectory()) {
    if (SCANNED_EXTENSIONS.includes(extname(targetPath))) {
      fileList.push(targetPath);
    }
    return fileList;
  }
  const entries = readdirSync(targetPath);
  for (const entry of entries) {
    const fullPath = join(targetPath, entry);
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const s = statSync(fullPath);
    if (s.isDirectory()) {
      scanPath(fullPath, fileList);
    } else if (SCANNED_EXTENSIONS.includes(extname(entry))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const targetPath = resolve(process.argv[2] || 'apps/frontend/src');
console.log(`Scanning for banned physical directional classes in: ${targetPath}`);

const files = scanPath(targetPath);
let violationCount = 0;

for (const file of files) {
  // Test files legitimately contain physical classes as fixtures.
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(file)) continue;

  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    for (const { regex, replacement } of BANNED_PATTERNS) {
      regex.lastIndex = 0;
      const matches = line.match(regex);
      if (matches) {
        console.warn(`[BIDI VIOLATION] ${file}:${idx + 1}`);
        console.warn(`  Found: ${matches.join(', ')} -> Use BiDi logical property: ${replacement}`);
        console.warn(`  Line: ${line.trim()}`);
        violationCount += matches.length;
      }
    }
  });
}

console.log(`Scanned ${files.length} files.`);

if (violationCount > 0) {
  console.error(`\n❌ Found ${violationCount} BiDi physical layout violations.`);
  process.exit(1);
} else {
  console.log('✅ All checked files adhere to BiDi logical layout classes.');
  process.exit(0);
}

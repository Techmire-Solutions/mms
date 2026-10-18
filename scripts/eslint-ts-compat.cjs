// ESLint / TypeScript dual-version compat shim.
//
// WHY THIS EXISTS: this repo builds with TypeScript 7 (the native/Go port,
// "~7.0.2" in devDependencies) for speed, but typescript-eslint@8 can only
// understand the classic tsc parser (TS 5.x/6.x line). ESLint would otherwise
// parse every file with TS 7 and either fail or silently diverge.
//
// HOW IT WORKS: this module is preloaded via `node -r` (see the app
// `lint` scripts) and aliases `require('typescript')` to `typescript-v6`
// (npm:typescript@~6.0.3, pinned in the root package.json) FOR THE LINT
// PROCESS ONLY. Normal builds/typecheck keep using TS 7.
//
// EXIT PATHS: if typescript-v6 is missing we hard-fail instead of falling
// back to TS 7 — a silent fallback would make rule behavior differ per
// machine (older findings from the repo review: "silently degrades").
const Module = require("module");

let ts6;
try {
  ts6 = require("typescript-v6");
} catch (err) {
  console.error(
    "[eslint-ts-compat] FATAL: typescript-v6 not found. This workspace lints " +
      "with TypeScript 6 (typescript-eslint cannot parse TS 7 yet). Run " +
      "`pnpm install` a second time so the root devDependency aliases " +
      "(typescript-v6 -> npm:typescript@6) resolve, then retry lint.",
  );
  process.exit(1);
}

const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "typescript") {
    return ts6;
  }
  return origRequire.apply(this, arguments);
};

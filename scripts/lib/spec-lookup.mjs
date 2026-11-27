// Shared resolver for the per-domain test-matrix gates.
//
// Why: those gates pin a spec by path ("apps/tenant-web/src/tenant/features/<domain>/…"). Every time a
// domain is extracted into `@mms/mod-*` the pinned path dies and the gate reports a missing invariant
// that is merely a moved file — twice in one day for obligations, once for examinations (P21/P23).
// The invariant is the spec and its scenario names, not the address, so a missed path falls back to a
// search by basename across the trees a spec can legitimately live in.

import fs from "node:fs";
import path from "node:path";

import { ROOT, IGNORED_DIRS } from "./repo-paths.mjs";

/** Trees a tenant/app spec can move between. */
export const DEFAULT_SPEC_ROOTS = Object.freeze(["apps/tenant-web/src", "packages/modules"]);

/**
 * Find the first file named `basename` under any of `roots`, depth-first, skipping build output.
 * Returns an absolute path or null.
 */
export function findSpecByBasename(basename, roots = DEFAULT_SPEC_ROOTS) {
  for (const root of roots) {
    const absoluteRoot = path.join(ROOT, root);
    const stack = [absoluteRoot];
    while (stack.length > 0) {
      const dir = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.name.startsWith(".") || IGNORED_DIRS.includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (entry.name === basename) return full;
      }
    }
  }
  return null;
}

/**
 * Resolve one matrix requirement to a file that exists.
 *
 * Accepts either `{ file }` (the historical pinned path) or `{ spec }` (a basename), and falls back to
 * a basename search when the pinned path is gone. Returns `{ path }` or `{ missing: true }`.
 */
export function resolveRequirement(requirement, options = {}) {
  const roots = options.roots ?? DEFAULT_SPEC_ROOTS;
  const lookup = options.lookup ?? findSpecByBasename;

  if (requirement.spec) {
    const found = lookup(requirement.spec, roots);
    return found ? { path: found } : { missing: true, spec: requirement.spec };
  }

  const pinned = requirement.file;
  const absolute = path.isAbsolute(pinned) ? pinned : path.join(ROOT, pinned);
  if (fs.existsSync(absolute)) return { path: absolute };

  const byBasename = lookup(path.basename(pinned), roots);
  if (byBasename) return { path: byBasename, movedFrom: pinned };
  return { missing: true, spec: pinned };
}

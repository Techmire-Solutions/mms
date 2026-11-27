import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guard: a module Setup surface must render exactly ONE
 * `<ModuleSetupSaveFooter>`. Two footers double the Save button (and the unsaved
 * navigation guard) on the same page, so a save can be triggered from either copy
 * while the other still looks dirty.
 *
 * A file that genuinely needs more than one is listed in the (currently empty)
 * exception map with the reason it is intentional.
 */

const SRC_ROOT = resolve(process.cwd(), "src");
const FEATURES_ROOT = join(SRC_ROOT, "tenant", "features");
const PACKAGES_MODULES_ROOT = resolve(process.cwd(), "../../packages/modules");

/** Feature surfaces now live both in the app shell and in module packages. */
function featureRoots(): string[] {
  const roots = [FEATURES_ROOT];
  if (existsSync(PACKAGES_MODULES_ROOT)) {
    for (const mod of readdirSync(PACKAGES_MODULES_ROOT)) {
      const tenantFeatures = join(
        PACKAGES_MODULES_ROOT,
        mod,
        "src",
        "frontend",
        "tenant",
        "features",
      );
      const tenantRoot = join(PACKAGES_MODULES_ROOT, mod, "src", "frontend", "tenant");
      if (existsSync(tenantFeatures)) roots.push(tenantFeatures);
      else if (existsSync(tenantRoot)) roots.push(tenantRoot);
    }
  }
  return roots;
}

const ALLOWED_MULTIPLE_FOOTER_FILES: Record<string, string> = {
  // No file currently renders more than one footer; add `path: "reason"` only if
  // a surface genuinely hosts two independent setup sections with separate saves.
};

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) return walk(fullPath);
    return entry.endsWith(".tsx") && !entry.endsWith(".test.tsx") ? [fullPath] : [];
  });
}

describe("module setup save footer uniqueness", () => {
  it("renders at most one ModuleSetupSaveFooter per feature file", () => {
    const offenders: string[] = [];
    let footerCount = 0;

    for (const root of featureRoots()) {
      for (const file of walk(root)) {
        const relativePath = relative(resolve(process.cwd(), "../.."), file).replaceAll("\\", "/");
        const source = readFileSync(file, "utf8");
        const matches = source.match(/<ModuleSetupSaveFooter\b/g) ?? [];
        footerCount += matches.length;
        if (matches.length > 1 && !(relativePath in ALLOWED_MULTIPLE_FOOTER_FILES)) {
          offenders.push(`${relativePath}: ${matches.length} <ModuleSetupSaveFooter> renders`);
        }
      }
    }

    expect(offenders).toEqual([]);
    // Guard against a vacuous scan (wrong root / no fixtures found).
    expect(footerCount).toBeGreaterThan(0);
  });
});

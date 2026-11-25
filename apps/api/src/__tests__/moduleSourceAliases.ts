import fs from "node:fs";
import path from "node:path";

export interface RegexAlias {
  find: RegExp;
  replacement: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveSourceTarget(modDir: string, distTarget: string): string | null {
  if (!distTarget.startsWith("./dist/") || !distTarget.endsWith(".js")) return null;
  const relTs = `./src/${distTarget.slice("./dist/".length, -".js".length)}.ts`;
  return path.resolve(modDir, relTs);
}

/**
 * Resolves `@mms/mod-*` package exports from compiled `dist/` JS back to `src/` TS
 * so Vitest DB/RLS runs share one module instance and record accurate V8 coverage.
 */
export function buildModuleSourceAliases(repoRoot: string): RegexAlias[] {
  const modulesDir = path.resolve(repoRoot, "packages/modules");
  if (!fs.existsSync(modulesDir)) return [];

  const aliases: RegexAlias[] = [];
  for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const modDir = path.join(modulesDir, entry.name);
    const pkgPath = path.join(modDir, "package.json");
    if (!fs.existsSync(pkgPath)) continue;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      name?: string;
      exports?: Record<string, string | { import?: string }>;
    };
    if (!pkg.name || !pkg.exports) continue;

    for (const [subpath, target] of Object.entries(pkg.exports)) {
      if (!subpath.startsWith("./") || subpath === "./package.json") continue;
      const distTarget = typeof target === "string" ? target : target.import;
      if (!distTarget) continue;

      const srcTarget = resolveSourceTarget(modDir, distTarget);
      if (!srcTarget) continue;

      const fullSpec = `${pkg.name}${subpath.slice(1)}`;
      if (subpath.includes("*")) {
        const prefix = `${escapeRegExp(fullSpec.slice(0, fullSpec.indexOf("*")))}`;
        const suffix = escapeRegExp(fullSpec.slice(fullSpec.indexOf("*") + 1));
        aliases.push({
          find: new RegExp(`^${prefix}(.+?)${suffix}(?:\\.js)?$`),
          replacement: srcTarget.replace("*", "$1"),
        });
      } else if (fs.existsSync(srcTarget)) {
        aliases.push({
          find: new RegExp(`^${escapeRegExp(fullSpec)}$`),
          replacement: srcTarget,
        });
      }
    }
  }

  return aliases.sort((a, b) => b.find.source.length - a.find.source.length);
}

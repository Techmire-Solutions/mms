import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);

function listVerticalModules() {
  const modulesDir = path.join(repoRoot, "packages/modules");
  return readdirSync(modulesDir)
    .filter((name) => {
      const full = path.join(modulesDir, name);
      return statSync(full).isDirectory() && existsSync(path.join(full, "package.json"));
    })
    .sort();
}

test("ignore files exclude apps/api/uploads from git and Docker build contexts", () => {
  const gitignore = readFileSync(path.join(repoRoot, ".gitignore"), "utf8");
  const dockerignore = readFileSync(path.join(repoRoot, ".dockerignore"), "utf8");
  assert.match(gitignore, /^\/apps\/api\/uploads\/$/m);
  assert.match(dockerignore, /^\*\*\/uploads$/m);
});

test("apps/api/Dockerfile copies dist for every vertical module", () => {
  const dockerfile = readFileSync(path.join(repoRoot, "apps/api/Dockerfile"), "utf8");
  const missing = [];
  for (const mod of listVerticalModules()) {
    const pattern = new RegExp(
      `COPY\\s+--from=builder\\s+/app/packages/modules/${mod}/dist\\s+\\./packages/modules/${mod}/dist`,
    );
    if (!pattern.test(dockerfile)) {
      missing.push(mod);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `apps/api/Dockerfile is missing COPY for module dist(s): ${missing.join(", ")}`,
  );
});

test("local-ci.sh runs all buckets in --full mode and dynamically covers all vertical modules", () => {
  const localCiPath = path.join(repoRoot, "scripts/ci/local-ci.sh");
  execFileSync("bash", ["-n", localCiPath], { stdio: "pipe" });
  const src = readFileSync(localCiPath, "utf8");

  assert.match(
    src,
    /if \[\[ "\$FULL" -eq 1 \]\]; then[\s\S]*?NEED_FE=1[\s\S]*?NEED_BE_UNIT=1[\s\S]*?NEED_BE_DB=1[\s\S]*?NEED_E2E=1/,
    "local-ci.sh --full must enable FE, BE unit, BE DB, and E2E buckets even on a clean tree",
  );
  assert.match(
    src,
    /for\s+\w+\s+in\s+packages\/modules\/\*\//,
    "local-ci.sh must iterate packages/modules/*/ dynamically instead of hardcoding 9 modules",
  );
  assert.match(
    src,
    /vitest\.db\.config\.ts/,
    "local-ci.sh --with-db must discover/run module DB integration suites dynamically",
  );
});

test("module db-integration helpers resolve backendRoot to apps/api", () => {
  const expectedApiRoot = path.join(repoRoot, "apps/api");
  const broken = [];

  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith(".ts")) {
        const src = readFileSync(full, "utf8");
        const m = src.match(/const\s+backendRoot\s*=\s*resolve\(([\s\S]*?)\);/);
        if (!m) continue;
        const expr = m[1].replace(/import\.meta\.url/g, JSON.stringify(`file://${full}`));
        const resolved = vm.runInNewContext(`resolve(${expr})`, {
          resolve: path.resolve,
          dirname: path.dirname,
          fileURLToPath: () => full,
        });
        if (resolved !== expectedApiRoot) {
          broken.push(`${path.relative(repoRoot, full)} -> ${path.relative(repoRoot, resolved)}`);
        }
      }
    }
  };

  for (const mod of listVerticalModules()) {
    walk(path.join(repoRoot, "packages/modules", mod, "src/backend/__tests__/db-integration"));
  }

  assert.deepEqual(broken, [], `Broken backendRoot in module DB tests:\n${broken.join("\n")}`);
});

test("workspace package and module Vitest configs configure testTimeout >= 15000 and maxWorkers", () => {
  const configs = [
    "packages/be-core/vitest.config.ts",
    "packages/fe-core/vitest.config.ts",
    "packages/ui/vitest.config.ts",
  ];
  for (const mod of listVerticalModules()) {
    for (const cfg of ["vitest.backend.config.ts", "vitest.frontend.config.ts"]) {
      const rel = path.posix.join("packages/modules", mod, cfg);
      if (existsSync(path.join(repoRoot, rel))) configs.push(rel);
    }
  }

  const missing = [];
  for (const rel of configs) {
    const src = readFileSync(path.join(repoRoot, rel), "utf8");
    const timeoutMatch = src.match(/testTimeout:\s*([0-9_]+)/);
    const timeoutVal = timeoutMatch ? Number(timeoutMatch[1].replace(/_/g, "")) : 0;
    const hasMaxWorkers = /maxWorkers:/.test(src);
    if (timeoutVal < 15_000 || !hasMaxWorkers) {
      missing.push(`${rel} (testTimeout=${timeoutVal}, maxWorkers=${hasMaxWorkers})`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `Vitest configs missing testTimeout >= 15_000 or maxWorkers:\n${missing.join("\n")}`,
  );
});

test("CI and E2E nightly workflows execute every Playwright project (chromium, platform, a11y)", () => {
  const ciYml = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
  const nightlyYml = readFileSync(path.join(repoRoot, ".github/workflows/e2e-nightly.yml"), "utf8");
  for (const proj of ["chromium", "platform", "a11y"]) {
    assert.match(
      ciYml,
      new RegExp(`-\\s+project:\\s+${proj}\\b`),
      `ci.yml missing e2e project ${proj}`,
    );
    assert.match(
      nightlyYml,
      new RegExp(`-\\s+project:\\s+${proj}\\b`),
      `e2e-nightly.yml missing e2e project ${proj}`,
    );
  }
});

test("tenantBootstrap targets PLATFORM_BASE_URL (:5174) instead of tenant-web root", () => {
  const src = readFileSync(path.join(repoRoot, "e2e/helpers/tenantBootstrap.ts"), "utf8");
  assert.match(src, /PLATFORM_BASE_URL/);
  assert.doesNotMatch(src, /page\.goto\("\/"/);
});

test("local-ci.sh detects reachable PostgreSQL via node:net fallback when pg_isready is absent", () => {
  const src = readFileSync(path.join(repoRoot, "scripts/ci/local-ci.sh"), "utf8");
  assert.match(src, /postgres_ready\(\)/);
  assert.match(src, /node:net/);
});

test("module vitest.db.config.ts files for port-bound modules wire composition-root dbIntegrationSetup", () => {
  const missing = [];
  for (const mod of listVerticalModules()) {
    const dbCfgPath = path.join(repoRoot, "packages/modules", mod, "vitest.db.config.ts");
    const depsPath = path.join(repoRoot, "packages/modules", mod, "src/backend/deps.ts");
    if (!existsSync(dbCfgPath) || !existsSync(depsPath)) continue;
    const src = readFileSync(dbCfgPath, "utf8");
    if (!src.includes("dbIntegrationSetup.ts")) {
      missing.push(`packages/modules/${mod}/vitest.db.config.ts`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `Port-bound module vitest.db.config.ts missing dbIntegrationSetup.ts:\n${missing.join("\n")}`,
  );
});

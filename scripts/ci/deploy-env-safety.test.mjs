import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const deploy = readFileSync(new URL("../deploy-on-server.sh", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../deploy-rollback.sh", import.meta.url), "utf8");
const packageDist = readFileSync(new URL("./package-dist.sh", import.meta.url), "utf8");
const remoteDeploy = readFileSync(new URL("./remote/deploy.sh", import.meta.url), "utf8");
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("deploy shell scripts pass bash syntax check", () => {
  for (const rel of [
    "scripts/deploy-on-server.sh",
    "scripts/deploy-rollback.sh",
    "scripts/ci/package-dist.sh",
    "scripts/ci/remote/deploy.sh",
  ]) {
    execFileSync("bash", ["-n", path.join(repoRoot, rel)], { stdio: "pipe" });
  }
});

test("deploy arms the env snapshot before merging the deploy env", () => {
  const arm = deploy.indexOf('ENV_BACKUP="$ENV_BACKUP_TMP"');
  const merge = deploy.indexOf("bash scripts/merge-backend-env.sh");
  assert.ok(arm > 0, "deploy script must arm ENV_BACKUP");
  assert.ok(merge > 0, "deploy script must merge the env");
  assert.ok(arm < merge, "ENV_BACKUP must be armed before merge-backend-env.sh");
});

test("deploy restores the env snapshot on a failed exit", () => {
  assert.match(deploy, /trap restore_env_and_cleanup EXIT/);
  assert.match(deploy, /cp -p "\$ENV_BACKUP" "\$ENV_FILE"/);
});

test("deploy migrates legacy apps/backend/.env and validates ENV_FILE before tarball extraction", () => {
  assert.match(deploy, /apps\/backend\/\.env/);
  const legacyMigrate = deploy.indexOf("apps/backend/.env");
  const extract = deploy.indexOf('tar xzf "$TARBALL"');
  const envMissingFail = deploy.indexOf("FATAL: ${ENV_FILE} is missing");
  assert.ok(legacyMigrate > 0 && extract > 0, "must reference legacy env and tarball extract");
  assert.ok(legacyMigrate < extract, "legacy .env migration must run before tarball extraction");
  assert.ok(
    envMissingFail > 0 && envMissingFail < extract,
    "missing ENV_FILE guard must run before tarball extraction",
  );
  // Missing ENV_FILE must mark preflight failed so rollback does not reload or destroy running release.
  const preflightCheck = deploy.slice(envMissingFail, envMissingFail + 200);
  assert.match(preflightCheck, /fail_preflight/);
  assert.match(remoteDeploy, /apps\/backend\/\.env/);
});

test("deploy migrates legacy apps/backend/uploads into apps/api/uploads non-destructively", () => {
  assert.match(deploy, /apps\/backend\/uploads/);
  assert.match(deploy, /apps\/api\/uploads/);
  assert.match(deploy, /--ignore-existing|cp -rn/);
});

test("deploy cleans contracts and all module dists and uses valid directory checks", () => {
  assert.match(deploy, /packages\/contracts\/dist/);
  assert.match(deploy, /packages\/modules\/\*\/dist/);
  assert.doesNotMatch(deploy, /\[ ! -d "[^"]+" "[^"]+" \]/);
  assert.match(deploy, /pm_exec_path/);
});

test("preflight failures leave a marker so rollback does not reload", () => {
  assert.match(deploy, /FAILED_PREFLIGHT_FILE=/);
  assert.match(deploy, /touch "\$FAILED_PREFLIGHT_FILE"/);
  assert.match(rollback, /\.deploy-preflight-failed/);
  assert.match(rollback, /skipping rollback/);
});

test("rollback restores the release's own env snapshot and handles both monorepo and legacy layouts", () => {
  assert.match(rollback, /RELEASE_ENV="\$\{TARBALL%\.tar\.gz\}\.env"/);
  const restore = rollback.indexOf('cp -p "$RELEASE_ENV" "$ENV_FILE"');
  const reload = rollback.indexOf("pm2 startOrReload");
  assert.ok(restore > 0, "rollback must copy the release env");
  assert.ok(reload > 0, "rollback must reload PM2");
  assert.ok(restore < reload, "env must be restored before PM2 reload");
  assert.match(rollback, /packages\/contracts\/dist/);
  assert.match(rollback, /packages\/modules\/\*\/dist/);
  assert.match(rollback, /apps\/backend\/dist\/index\\?\.js/);
});

test("package-dist packages core packages and dynamically includes all vertical module dists", () => {
  assert.match(packageDist, /packages\/contracts\/dist/);
  assert.match(packageDist, /packages\/db\/dist/);
  assert.match(packageDist, /packages\/be-core\/dist/);
  assert.match(packageDist, /for\s+\w+\s+in\s+packages\/modules\/\*\//);
});

test("be-core and module backends avoid inline-type-only fastify imports that emit runtime side-effect imports", () => {
  const roots = [path.join(repoRoot, "packages/be-core/src")];
  const modulesDir = path.join(repoRoot, "packages/modules");
  for (const mod of readdirSync(modulesDir)) {
    const backendSrc = path.join(modulesDir, mod, "src/backend");
    if (existsSync(backendSrc) && statSync(backendSrc).isDirectory()) {
      roots.push(backendSrc);
    }
  }
  const offenders = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== "__tests__") walk(full);
      } else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) {
        const src = readFileSync(full, "utf8");
        const m = src.match(/^import\s+\{([^}]+)\}\s+from\s+["']fastify["'];?/m);
        if (m) {
          const items = m[1]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          if (items.length > 0 && items.every((s) => /^type\s+/.test(s))) {
            offenders.push(path.relative(repoRoot, full));
          }
        }
      }
    }
  };
  for (const r of roots) walk(r);
  assert.deepEqual(
    offenders,
    [],
    `Use \`import type { ... } from "fastify"\` so tsc does not emit \`import {} from "fastify"\`: ${offenders.join(", ")}`,
  );
});

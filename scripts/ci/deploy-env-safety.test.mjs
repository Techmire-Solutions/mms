import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const deploy = readFileSync(new URL("../deploy-on-server.sh", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../deploy-rollback.sh", import.meta.url), "utf8");

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

test("preflight failures leave a marker so rollback does not reload", () => {
  assert.match(deploy, /FAILED_PREFLIGHT_FILE=/);
  assert.match(deploy, /touch "\$FAILED_PREFLIGHT_FILE"/);
  assert.match(rollback, /\.deploy-preflight-failed/);
  assert.match(rollback, /skipping rollback/);
});

test("rollback restores the release's own env snapshot before reloading", () => {
  assert.match(rollback, /RELEASE_ENV="\$\{TARBALL%\.tar\.gz\}\.env"/);
  const restore = rollback.indexOf('cp -p "$RELEASE_ENV" "$ENV_FILE"');
  const reload = rollback.indexOf("pm2 startOrReload");
  assert.ok(restore > 0, "rollback must copy the release env");
  assert.ok(reload > 0, "rollback must reload PM2");
  assert.ok(restore < reload, "env must be restored before PM2 reload");
});

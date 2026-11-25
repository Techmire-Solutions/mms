import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

/**
 * Executable proof of the architecture rules in
 * `tooling/eslint-config/boundaries.mjs`:
 *
 *   apps/*            → never another app
 *   packages/modules/* → never an app
 *   core packages     → never a module or an app
 *
 * Imports point at real files so the plugin's dependency resolution runs exactly
 * as it does during `pnpm lint`; the source file itself can be virtual because
 * element classification only needs its path.
 */
const ROOT = process.cwd();
const requireFromRoot = createRequire(path.join(ROOT, "package.json"));
requireFromRoot("./scripts/eslint-ts-compat.cjs");
const requireFromTooling = createRequire(path.join(ROOT, "tooling/eslint-config/package.json"));
const { ESLint } = requireFromTooling("eslint");
const { createNodeConfig } = await import(
  pathToFileURL(path.join(ROOT, "tooling/eslint-config/node.mjs")).href
);
const { createReactConfig } = await import(
  pathToFileURL(path.join(ROOT, "tooling/eslint-config/react.mjs")).href
);

const nodeEslint = new ESLint({
  cwd: ROOT,
  overrideConfigFile: true,
  overrideConfig: createNodeConfig({ files: ["**/*.ts"], rootPath: ROOT }),
});
const reactEslint = new ESLint({
  cwd: ROOT,
  overrideConfigFile: true,
  overrideConfig: createReactConfig({ files: ["**/*.ts"], rootPath: ROOT }),
});

async function boundaryMessages(eslint, source, filePath) {
  const [result] = await eslint.lintText(source, { filePath: path.join(ROOT, filePath) });
  return result.messages.filter((message) => message.ruleId === "boundaries/dependencies");
}

function assertDenied(messages, fromType, toType) {
  assert.ok(messages.length > 0, `expected a boundary violation from ${fromType} to ${toType}`);
  assert.match(
    messages[0].message,
    new RegExp(`from elements of type "${fromType}".*to elements of type "${toType}"`),
    `unexpected boundary message: ${messages[0].message}`,
  );
}

test("apps may not import another app", async () => {
  const messages = await boundaryMessages(
    nodeEslint,
    'import app from "../../tenant-web/src/App.tsx";\nconsole.log(app);',
    "apps/api/src/probe.ts",
  );
  assertDenied(messages, "app", "app");
});

test("modules may not import an app", async () => {
  const messages = await boundaryMessages(
    nodeEslint,
    'import app from "../../../../../apps/api/src/index.ts";\nconsole.log(app);',
    "packages/modules/iam/src/backend/probe.ts",
  );
  assertDenied(messages, "module-backend", "app");
});

test("ui may not import a module", async () => {
  const messages = await boundaryMessages(
    reactEslint,
    'import ports from "../../modules/accounting/src/backend/ports.ts";\nconsole.log(ports);',
    "packages/ui/src/probe.ts",
  );
  assertDenied(messages, "ui", "module-backend");
});

test("contracts may not import a module", async () => {
  const messages = await boundaryMessages(
    nodeEslint,
    'import ports from "../../modules/accounting/src/backend/ports.ts";\nconsole.log(ports);',
    "packages/contracts/src/probe.ts",
  );
  assertDenied(messages, "contracts", "module-backend");
});

test("apps may import contracts", async () => {
  const messages = await boundaryMessages(
    nodeEslint,
    'import contracts from "../../../packages/contracts/src/index.ts";\nconsole.log(contracts);',
    "apps/api/src/probe.ts",
  );
  assert.deepEqual(messages, [], "app → contracts must stay allowed");
});

test("module frontend audiences may import ui", async () => {
  const messages = await boundaryMessages(
    reactEslint,
    'import ui from "../../../../../ui/src/index.ts";\nconsole.log(ui);',
    "packages/modules/accounting/src/frontend/tenant/probe.ts",
  );
  assert.deepEqual(messages, [], "module-fe-tenant → ui must stay allowed");
});

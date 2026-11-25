import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = process.cwd();
const requireFromRoot = createRequire(path.join(ROOT, "package.json"));
requireFromRoot("./scripts/eslint-ts-compat.cjs");
const requireFromTooling = createRequire(path.join(ROOT, "tooling/eslint-config/package.json"));
const requireFromApp = createRequire(path.join(ROOT, "apps/tenant-web/package.json"));
const { ESLint, Linter } = requireFromTooling("eslint");
const tenantPlatformDynamicImportRule = requireFromApp(
  "./eslint-rules/no-tenant-platform-dynamic-import.cjs",
);
const { audienceImportRestrictions, createReactConfig } = await import(
  path.join(ROOT, "tooling/eslint-config/react.mjs")
);

async function lint(source, filePath, appKind, audienceRules) {
  const config = createReactConfig({
    files: ["**/*.ts"],
    appKind,
    rootPath: ROOT,
    ...(audienceRules ? { rules: audienceRules } : {}),
  });
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfigFile: true,
    overrideConfig: config,
  });
  return eslint.lintText(source, { filePath: path.join(ROOT, filePath) });
}

/** Mirrors `apps/tenant-web/eslint.config.js`: hybrid bundle + audience-locked subtree. */
function lintHybridSubtree(source, subtree, audience) {
  return lint(
    source,
    `apps/tenant-web/src/${subtree}/probe.ts`,
    "app",
    audienceImportRestrictions(audience),
  );
}

const IMPORT_PLATFORM = 'import { GlobalUsersTable } from "@mms/mod-iam/frontend/platform";\n';
const IMPORT_BACKEND = 'import { createIamService } from "@mms/mod-iam/backend/tenant";\n';
const IMPORT_TENANT = 'import { TeamMembersPage } from "@mms/mod-iam/frontend/tenant";\n';
const IMPORT_SHARED = 'import type { IamMemberSummary } from "@mms/mod-iam/shared";\n';

test("tenant-web cannot import a module platform frontend audience", async () => {
  const [result] = await lint(IMPORT_PLATFORM, "apps/tenant-web/src/probe.ts", "tenant");
  assert.ok(
    result.messages.some((message) => message.ruleId === "no-restricted-imports"),
    "expected no-restricted-imports for @mms/mod-iam/frontend/platform",
  );
});

test("tenant-web cannot import a module backend audience", async () => {
  const [result] = await lint(IMPORT_BACKEND, "apps/tenant-web/src/probe.ts", "tenant");
  assert.ok(
    result.messages.some((message) => message.ruleId === "no-restricted-imports"),
    "expected no-restricted-imports for @mms/mod-iam/backend/tenant",
  );
});

test("tenant-web can import shared and tenant frontend audiences", async () => {
  const [shared] = await lint(IMPORT_SHARED, "apps/tenant-web/src/probe.ts", "tenant");
  const [tenant] = await lint(
    `${IMPORT_SHARED}${IMPORT_TENANT}`,
    "apps/tenant-web/src/probe.ts",
    "tenant",
  );
  assert.ok(!shared.messages.some((message) => message.ruleId === "no-restricted-imports"));
  assert.ok(!tenant.messages.some((message) => message.ruleId === "no-restricted-imports"));
});

test("platform-web is blocked from tenant and backend audiences", async () => {
  const [tenant] = await lint(IMPORT_TENANT, "apps/platform-web/src/probe.ts", "platform");
  const [backend] = await lint(IMPORT_BACKEND, "apps/platform-web/src/probe.ts", "platform");
  assert.ok(tenant.messages.some((message) => message.ruleId === "no-restricted-imports"));
  assert.ok(backend.messages.some((message) => message.ruleId === "no-restricted-imports"));
});

const IMPORT_ROOT = 'import { X } from "@mms/mod-iam";\nconsole.log(X);\n';
const IMPORT_OTHER_MODULE_PLATFORM = 'import { X } from "@mms/mod-accounting/frontend/platform";\n';

test("no app audience may import a module root", async () => {
  for (const [appKind, filePath] of [
    ["tenant", "apps/tenant-web/src/probe.ts"],
    ["platform", "apps/platform-web/src/probe.ts"],
    ["app", "apps/tenant-web/src/probe.ts"],
  ]) {
    const [result] = await lint(IMPORT_ROOT, filePath, appKind);
    assert.ok(
      result.messages.some((message) => message.ruleId === "no-restricted-imports"),
      `expected no-restricted-imports for a module root import (${appKind})`,
    );
  }
});

test("tenant-web is blocked from any module's platform audience", async () => {
  const [result] = await lint(
    IMPORT_OTHER_MODULE_PLATFORM,
    "apps/tenant-web/src/probe.ts",
    "tenant",
  );
  assert.ok(result.messages.some((message) => message.ruleId === "no-restricted-imports"));
});

test("the hybrid apps/tenant-web bundle may import both frontend audiences", async () => {
  for (const source of [IMPORT_PLATFORM, IMPORT_TENANT]) {
    const [result] = await lint(source, "apps/tenant-web/src/probe.ts", "app");
    assert.ok(
      !result.messages.some((message) => message.ruleId === "no-restricted-imports"),
      `expected the hybrid bundle to allow ${source.trim()}`,
    );
  }
});

test("the hybrid tenant subtree cannot import a platform frontend audience", async () => {
  const [result] = await lintHybridSubtree(IMPORT_PLATFORM, "tenant", "tenant");
  assert.ok(
    result.messages.some((message) => message.ruleId === "no-restricted-imports"),
    "expected the tenant subtree to reject @mms/mod-iam/frontend/platform",
  );
  const [backend] = await lintHybridSubtree(IMPORT_BACKEND, "tenant", "tenant");
  assert.ok(backend.messages.some((message) => message.ruleId === "no-restricted-imports"));
});

test("the hybrid tenant subtree still allows shared and tenant audiences", async () => {
  const [result] = await lintHybridSubtree(`${IMPORT_SHARED}${IMPORT_TENANT}`, "tenant", "tenant");
  assert.ok(!result.messages.some((message) => message.ruleId === "no-restricted-imports"));
});

test("the hybrid platform subtree cannot import a tenant frontend audience", async () => {
  const [result] = await lintHybridSubtree(IMPORT_TENANT, "platform", "platform");
  assert.ok(
    result.messages.some((message) => message.ruleId === "no-restricted-imports"),
    "expected the platform subtree to reject @mms/mod-iam/frontend/tenant",
  );
});

test("tenant apps are blocked from bare and relative platform console specifiers", async () => {
  for (const source of [
    'import x from "@/platform/features/x";\nconsole.log(x);',
    'export * from "../../platform/routes/ApexRoutes";',
  ]) {
    const [result] = await lint(source, "apps/tenant-web/src/probe.ts", "tenant");
    assert.ok(
      result.messages.some((message) => message.ruleId === "no-restricted-imports"),
      `expected no-restricted-imports for ${source}`,
    );
  }
});

test("the platform specifier rule does not flag platform-branded non-console modules", async () => {
  const [result] = await lint(
    'import x from "@/lib/branding/platformBrandingStore";\nconsole.log(x);',
    "apps/tenant-web/src/probe.ts",
    "tenant",
  );
  assert.ok(!result.messages.some((message) => message.ruleId === "no-restricted-imports"));
});

const DYNAMIC_IMPORT_CONFIG = [
  {
    files: ["**/*.ts"],
    plugins: {
      "mms-boundary": {
        rules: { "no-tenant-platform-dynamic-import": tenantPlatformDynamicImportRule },
      },
    },
    rules: { "mms-boundary/no-tenant-platform-dynamic-import": "error" },
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
  },
];

function lintDynamicImport(code) {
  return new Linter().verify(code, DYNAMIC_IMPORT_CONFIG, {
    filename: "apps/tenant-web/src/tenant/probe.ts",
  });
}

test("tenant code cannot dynamically import the platform console", () => {
  for (const code of [
    'const x = import("@/platform/features/x");\nconsole.log(x);',
    'const x = import("../../platform/features/x");\nconsole.log(x);',
    'const x = require("@/platform/features/x");\nconsole.log(x);',
  ]) {
    const messages = lintDynamicImport(code);
    assert.ok(
      messages.some(
        (message) => message.ruleId === "mms-boundary/no-tenant-platform-dynamic-import",
      ),
      `expected the dynamic platform ban for ${code}`,
    );
  }
});

test("the dynamic platform ban does not flag non-platform imports", () => {
  const messages = lintDynamicImport('const x = import("@mms/ui");\nconsole.log(x);');
  assert.equal(
    messages.filter(
      (message) => message.ruleId === "mms-boundary/no-tenant-platform-dynamic-import",
    ).length,
    0,
  );
});

/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { Linter } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const rule = require("../../eslint-rules/no-cross-feature-imports.cjs");
const RULE_ID = "mms-boundary/no-cross-feature-imports";

const linter = new Linter();
const config: Linter.Config[] = [
  {
    // A `files` entry is required for the rule to apply in this harness; flat-config
    // matching is relative, so test filenames are `src/...` (absolute paths can't be
    // matched here — production firing is covered by linting the real tree).
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    plugins: { "mms-boundary": { rules: { "no-cross-feature-imports": rule } } },
    rules: { [RULE_ID]: "error" },
  },
];

/** Rule ids reported for `code` when linted as `filename`. */
function lint(code: string, filename: string): string[] {
  return linter
    .verify(code, config, filename)
    .filter((m) => m.ruleId === RULE_ID)
    .map((m) => m.messageId ?? "");
}

const STUDENT_HOOK = "src/tenant/features/students/hooks/useX.ts";

/**
 * The baseline is pruned as exceptions resolve, so deriving the fixture from it keeps these
 * cases meaningful without a hardcoded file that can lose its entry.
 */
const baselineEntries: Record<
  string,
  string[]
> = require("../../eslint-rules/feature-internal-imports-baseline.json");
const baselinedFile: string | undefined = Object.keys(baselineEntries)[0];
const sanctionedTargets: string[] = baselinedFile ? (baselineEntries[baselinedFile] ?? []) : [];
const SANCTIONED_IMPORTS = sanctionedTargets.map(
  (feature, index) =>
    `import { s${index} } from "@/tenant/features/${feature}/hooks/useSanctioned";`,
);

describe("no-cross-feature-imports", () => {
  describe("feature → feature (existing behaviour)", () => {
    it("allows a feature to import its own module", () => {
      expect(
        lint(`import { y } from "@mms/mod-students/frontend/tenant/hooks/useY";`, STUDENT_HOOK),
      ).toEqual([]);
    });

    it("allows the sanctioned reports/settings targets", () => {
      expect(
        lint(`import { K } from "@/tenant/features/reports/components/KPISummary";`, STUDENT_HOOK),
      ).toEqual([]);
    });

    it("flags importing another feature's internals", () => {
      expect(
        lint(
          // A feature-internal target: module packages (`@mms/mod-*`) are out of this rule's scope.
          `import { f } from "@/tenant/features/examinations/hooks/useExaminationsApi";`,
          STUDENT_HOOK,
        ),
      ).toEqual(["crossFeature"]);
    });
  });

  describe("shared layer → feature (new mode)", () => {
    it("allows the collections facades to import features", () => {
      expect(
        lint(
          `import { a } from "@mms/mod-billing/frontend/tenant/hooks/useFinanceApi";`,
          "src/tenant/hooks/collections/finance.ts",
        ),
      ).toEqual([]);
    });

    it("allows shared layers to import lib/ and @mms/contracts", () => {
      expect(
        lint(
          `import { a } from "@/lib/utils";\nimport { b } from "@mms/contracts";`,
          "src/hooks/foo.ts",
        ),
      ).toEqual([]);
    });

    it("does not police components/ui (owned by no-ui-host-imports)", () => {
      expect(
        lint(`import { a } from "@/tenant/features/x/hooks/y";`, "src/components/ui/Card.tsx"),
      ).toEqual([]);
    });

    it("skips co-located test files", () => {
      expect(
        lint(
          `import { a } from "@/tenant/features/x/hooks/y";`,
          "src/components/dashboard-widgets/x.test.tsx",
        ),
      ).toEqual([]);
    });

    it.each([
      ["src/hooks/standardModuleConfigsAcademic.ts"],
      ["src/components/dashboard-widgets/FeeCollectionSummary.tsx"],
      ["src/tenant/hooks/notifications/useTenantNotifications.ts"],
    ])("flags %s importing a feature internal", (filename) => {
      expect(
        lint(`import { a } from "@/tenant/features/dashboard/hooks/useDashboardData";`, filename),
      ).toEqual(["sharedLayer"]);
    });

    it("flags a dynamic import from a shared layer", () => {
      expect(
        lint(`const m = await import("@/tenant/features/x/hooks/y");`, "src/hooks/foo.ts"),
      ).toEqual(["sharedLayer"]);
    });

    // A re-export reaches into a feature exactly as an import does. These were unchecked
    // until the baseline's staleness check exposed it — an exception looked "resolved"
    // because the re-export was never observed.
    it("flags a named re-export from a shared layer", () => {
      expect(
        lint(`export { X } from "@/tenant/features/x/components/X";`, "src/hooks/foo.ts"),
      ).toEqual(["sharedLayer"]);
    });

    it("flags an export-all re-export from a shared layer", () => {
      expect(
        lint(`export * from "@/tenant/features/x/components/index";`, "src/hooks/foo.ts"),
      ).toEqual(["sharedLayer"]);
    });
  });

  describe("bridge layers (baseline)", () => {
    it("ignores module-package imports (not feature targets)", () => {
      // Contacts moved into @mms/mod-contacts, so this is no longer a feature-internal edge;
      // the bridge baselines that used to sanction it were pruned with the move.
      expect(
        lint(
          `import { a } from "@mms/mod-contacts/frontend/tenant/hooks/useContactSetupConfig";`,
          "src/lib/contexts/ContactConfigContext.tsx",
        ),
      ).toEqual([]);
    });

    it("flags a non-baselined edge from a baselined file", () => {
      if (!baselinedFile) return;
      const messages = lint(
        [
          ...SANCTIONED_IMPORTS,
          `import { b } from "@/tenant/features/examinations/hooks/useExaminationsApi";`,
        ].join("\n"),
        baselinedFile,
      );
      expect(messages).toContain("sharedLayer");
      expect(messages).not.toContain("stale");
    });

    it("flags a baselined file that imports nothing baselined", () => {
      if (!baselinedFile) return;
      const messages = lint(
        `import { a } from "@/tenant/features/examinations/hooks/useExaminationsApi";`,
        baselinedFile,
      );
      expect(messages).toContain("sharedLayer");
      expect(messages).toContain("stale");
    });

    it("sanctions reports/settings from bridge layers", () => {
      expect(
        lint(
          `import { a } from "@/tenant/features/settings/hooks/useGlobalSettingsDraft";`,
          "src/lib/contexts/SettingsGlobalDraftContext.tsx",
        ),
      ).toEqual([]);
    });

    it("excludes route wiring (lib/routing)", () => {
      expect(
        lint(
          `import("@mms/mod-billing/frontend/tenant/FinancePage");`,
          "src/lib/routing/routePrefetch.ts",
        ),
      ).toEqual([]);
    });

    it("reports a stale baseline entry", () => {
      if (!baselinedFile) return;
      // At least one `stale` report per sanctioned target the file no longer imports.
      expect(lint(`export const x = 1;`, baselinedFile)).toContain("stale");
    });
  });
});

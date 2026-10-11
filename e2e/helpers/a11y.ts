import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Accessibility assertions for the E2E suite.
 *
 * Implements the check the `mms-a11y-smoke` skill prescribes ("run
 * `@axe-core/playwright` on shell + one Work directory at 375 and 1440; fail on
 * serious/critical") — which previously had no tooling behind it, so it could
 * not actually be run.
 *
 * Scope choices:
 *  - WCAG 2.1 A + AA rules, matching the `wcag21aa` tag set axe recommends for
 *    a general-purpose app. Adding `best-practice` rules would surface dozens of
 *    style opinions and train people to ignore the gate.
 *  - Only `serious` and `critical` fail the build. `moderate`/`minor` findings
 *    are reported as annotations so they stay visible without blocking deploys —
 *    a gate that fails on trivia gets bypassed.
 *  - Colour-contrast checks are meaningful only in a real rendered browser,
 *    which is exactly why this lives in Playwright rather than a jsdom unit test.
 */

export type Impact = "minor" | "moderate" | "serious" | "critical";

/** Impacts that fail the test. */
const BLOCKING_IMPACTS: readonly Impact[] = ["serious", "critical"];

/**
 * Accepted-at-adoption baseline, keyed by axe rule id.
 *
 * These are PRE-EXISTING violations found when the gate was first switched on.
 * Listing them keeps CI green today and, more importantly, makes the debt
 * explicit: any rule NOT listed here fails the build, so the codebase cannot get
 * worse. Entries are surfaced as annotations on every run so they stay visible
 * rather than quietly forgotten.
 *
 * How each is expected to be removed: fix the underlying markup/design, delete
 * the entry, and let this gate hold the line. Do not add an entry to unblock a
 * change — fix the change instead.
 *
 * See `docs/a11y-baseline.md` for the current findings and their triage.
 */
/*
 * ─────────────────────────────────────────────────────────────────────────────
 * A11Y_BASELINE IS NOW EMPTY. Both entries that existed at adoption have been
 * retired, so every serious/critical WCAG 2.1 A/AA violation now fails the build.
 * Keep it that way: if a new violation appears, fix it rather than re-baselining.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `color-contrast` — removed. The gate runs clean across 15 audit contexts (5
 * routes × 2 viewports, 4 overlay dialogs, plus RTL).
 *
 * The root cause was not the markup the entry originally named. Every semantic
 * token is overwritten at runtime by the branding injector, and
 * `ensureAccessibleFillSurface` stopped as soon as EITHER white or dark text
 * passed on the fill — so a mid-tone brand colour that accepts a dark label kept
 * its bright fill (the test tenant resolved `--primary` to #db9d00, 2.37:1 on
 * white) and the token was unusable as text, on surfaces and on its own chip tint.
 * Fills are now fitted to all three roles; see
 * `packages/shared/src/brandingCssContrast.ts` and the three-role assertions in
 * `brandingTheme.test.ts` / `apps/frontend/src/__tests__/designTokens.contrast.test.ts`.
 *
 * `aria-hidden-focus` — removed. This one described itself as "intermittent,
 * ~1 in 6 runs, not attributable to a component". The `ProgressBar` ARIA conflict
 * that was fixed while investigating it (it spread `aria-hidden` onto its own
 * `role="progressbar"`) now looks like the actual cause, on the strength of the
 * absence: ~40 clean dashboard audits since, across 12 full gate runs and a
 * 16-audit focused reload loop, where the old rate was ~1 in 6. That is ~0.1%
 * likely if nothing had changed. The success path is also now better instrumented —
 * failures print the node's `html:` and axe's measured values — so if it does
 * recur, the output names the element.
 */
export const A11Y_BASELINE: Record<string, string> = {};

/**
 * When set, prints every violation as a JSON array and never fails. Used to
 * regenerate the baseline after a deliberate UI change.
 */
const COLLECT_MODE = process.env.A11Y_COLLECT === "1";

export interface A11yAuditOptions {
  /** Human-readable label used in failure messages, e.g. "dashboard @ 375px". */
  context: string;
  /** Extra axe rule IDs to disable, with a reason documented at the call site. */
  disabledRules?: string[];
  /**
   * CSS selectors for elements to exclude. Use sparingly and narrowly — for
   * third-party embeds you cannot fix, not for your own components.
   */
  exclude?: string[];
  /**
   * Limit the audit to a subtree (e.g. `#main-content`). Prefer this over
   * excluding chrome when the ready selector already names the surface under test.
   */
  include?: string[];
}

/** Result shape derived from the builder, so `axe-core` need not be a direct dep. */
type AxeResults = Awaited<ReturnType<InstanceType<typeof AxeBuilder>["analyze"]>>;

interface AxeViolationSummary {
  id: string;
  impact: Impact | null;
  help: string;
  nodes: number;
  sampleTargets: string[];
  /** Truncated outerHTML of the first offending node — makes a failure actionable. */
  sampleHtml: string;
  /**
   * axe's measured colours for `color-contrast` nodes.
   *
   * Without this the report names the element but not the numbers, and the
   * palette that produced them is *not* the one in `index.css`: the branding
   * injector overwrites every semantic token at runtime, so reasoning from source
   * gives the wrong answer. Printing fg/bg/ratio makes the real palette visible.
   */
  contrast: { fg: string; bg: string; ratio: string }[];
}

function summarize(violations: AxeResults["violations"]): AxeViolationSummary[] {
  return violations.map((violation) => ({
    id: violation.id,
    impact: (violation.impact as Impact | null) ?? null,
    help: violation.help,
    nodes: violation.nodes.length,
    // axe's `target` is an ARRAY of selectors that walks into frames/shadow roots.
    // Joining it with a space (the obvious thing) silently produced a composite
    // like `.card > .child[aria-hidden]` that looked like one CSS selector but
    // was actually two different elements — which sent me chasing the wrong
    // component. Keep the steps visually distinct so the target is unambiguous.
    sampleTargets: violation.nodes.slice(0, 3).map((node) => node.target.join(" >> ")),
    sampleHtml: (violation.nodes[0]?.html ?? "").replace(/\s+/g, " ").slice(0, 300),
    contrast: violation.nodes
      .slice(0, 3)
      .map((node) => {
        const data = node.any?.find((check) => check.data)?.data as
          { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined;
        if (!data?.fgColor || !data?.bgColor) return null;
        const ratio = typeof data.contrastRatio === "number" ? data.contrastRatio.toFixed(2) : "?";
        return { fg: data.fgColor, bg: data.bgColor, ratio };
      })
      .filter((entry): entry is { fg: string; bg: string; ratio: string } => entry !== null),
  }));
}

function renderSummary(summaries: AxeViolationSummary[]): string {
  return summaries
    .map(
      (v) =>
        `  • [${v.impact}] ${v.id} — ${v.help} (${v.nodes} node${v.nodes === 1 ? "" : "s"})\n` +
        v.sampleTargets.map((t) => `      ${t}`).join("\n") +
        (v.contrast.length > 0
          ? `\n      measured: ${v.contrast.map((c) => `${c.fg} on ${c.bg} = ${c.ratio}:1`).join(" | ")}`
          : "") +
        (v.sampleHtml ? `\n      html: ${v.sampleHtml}` : ""),
    )
    .join("\n");
}

/**
 * Runs axe against the current page state and fails on serious/critical
 * violations. Non-blocking findings are attached as test annotations.
 */
export async function assertNoSeriousA11yViolations(
  page: Page,
  options: A11yAuditOptions,
): Promise<void> {
  // Settle finite CSS animations and transitions (e.g. Radix dialog / popover fade-in,
  // card entrance animations) so axe does not measure mid-transition alpha-blended contrast.
  await page
    .evaluate(async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const finiteAnimations = document.getAnimations().filter((a) => {
        const timing = a.effect?.getTiming();
        return timing && timing.iterations !== Infinity;
      });
      return Promise.race([
        Promise.all(finiteAnimations.map((a) => a.finished)),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    })
    .catch(() => undefined);

  let builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    // WCAG 2.2 AA. The set was previously pinned to 2.1, which silently excluded
    // every 2.2 success criterion — notably `target-size` (2.5.8, the 24x24
    // minimum). The app targets 44px by construction, so this should hold; it is
    // added so that a regression in the touch-target floor is caught rather than
    // unchecked.
    "wcag22aa",
  ]);

  for (const selector of options.exclude ?? []) {
    builder = builder.exclude(selector);
  }
  for (const selector of options.include ?? []) {
    builder = builder.include(selector);
  }
  if (options.disabledRules && options.disabledRules.length > 0) {
    builder = builder.disableRules(options.disabledRules);
  }

  const results = await builder.analyze();
  const summaries = summarize(results.violations);

  const serious = summaries.filter((v) => v.impact && BLOCKING_IMPACTS.includes(v.impact));
  const advisory = summaries.filter((v) => !v.impact || !BLOCKING_IMPACTS.includes(v.impact));

  if (COLLECT_MODE) {
    console.log(
      `[a11y:collect] ${options.context} ${JSON.stringify(
        summaries.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes, help: v.help })),
      )}`,
    );
    return;
  }

  const baselined = serious.filter((v) => A11Y_BASELINE[v.id] !== undefined);
  const blocking = serious.filter((v) => A11Y_BASELINE[v.id] === undefined);

  if (baselined.length > 0) {
    console.log(
      `[a11y] ${options.context}: ${baselined.length} BASELINED violation(s) still present\n${renderSummary(baselined)}`,
    );
    for (const v of baselined) {
      test.info().annotations.push({
        type: `a11y-baseline:${v.id}`,
        description: `${options.context} — ${A11Y_BASELINE[v.id]}`,
      });
    }
  }

  if (advisory.length > 0) {
    // Visible without blocking: these are real findings worth tracking.
    console.log(
      `[a11y] ${options.context}: ${advisory.length} non-blocking finding(s)\n${renderSummary(advisory)}`,
    );
  }

  expect(
    blocking,
    `Accessibility violations (${BLOCKING_IMPACTS.join("/")}) at ${options.context}:\n` +
      `${renderSummary(blocking)}\n\n` +
      "Fix the markup, or disable the specific rule with a documented reason.",
  ).toEqual([]);
}

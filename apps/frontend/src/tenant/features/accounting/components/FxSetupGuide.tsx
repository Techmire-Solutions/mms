import type React from "react";
import { useId, useState } from "react";
import { ChevronDown, CircleHelp, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import {
  useAccountingNavigate,
  type AccountingNavigationTarget,
} from "@/tenant/features/accounting/hooks/useAccountingNavigation";
import { useFxSetupGuide } from "@/tenant/features/accounting/hooks/useFxSetupGuide";
import { FX_SETUP_ANCHORS, type FxSetupStepId } from "../lib/fxSetupReadiness";
import { FxSetupGuideStep } from "./FxSetupGuideStep";

const STEP_TARGETS: Record<FxSetupStepId, AccountingNavigationTarget> = {
  currencies: { tab: "setup", anchorId: FX_SETUP_ANCHORS.currencies },
  rates: { tab: "work", subTab: "periodEnd", anchorId: FX_SETUP_ANCHORS.rates },
  accounts: { tab: "setup", anchorId: FX_SETUP_ANCHORS.accounts },
};

const EXPLAIN_KEYS = [
  "accounting.fxGuide.explain.functional",
  "accounting.fxGuide.explain.transaction",
  "accounting.fxGuide.explain.rates",
  "accounting.fxGuide.explain.revaluation",
] as const;

/**
 * Role-aware multi-currency checklist. Each step shows live status; steps the
 * viewer cannot do say who to ask instead of offering a button.
 */
export function FxSetupGuide({ className }: { className?: string }): React.JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useAccountingNavigate();
  const { readiness, functionalCurrency, enabledCurrencies, isLoading, isError } =
    useFxSetupGuide();
  const [stepsOpen, setStepsOpen] = useState<boolean | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const headingId = useId();
  const stepsId = useId();
  const explainId = useId();

  if (isLoading || isError) return null;

  const showSteps = stepsOpen ?? (readiness.started && !readiness.ready);
  const summary = readiness.ready
    ? t("accounting.fxGuide.ready", { currencies: enabledCurrencies.join(", ") })
    : readiness.started
      ? t("accounting.fxGuide.progress", {
          done: String(readiness.completed),
          total: String(readiness.steps.length),
        })
      : t("accounting.fxGuide.notStarted");

  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-xl border border-info/30 bg-info/5 px-4 py-3", className)}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Compass className="h-5 w-5 shrink-0 text-info" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="m-0 text-sm font-semibold text-foreground text-balance">
            {t("accounting.fxGuide.title")}
          </h3>
          <p className="m-0 text-xs text-muted-foreground" role="status">
            {summary}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-expanded={explainOpen}
          aria-controls={explainId}
          onClick={() => setExplainOpen((open) => !open)}
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
          {t("accounting.fxGuide.howItWorks")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-expanded={showSteps}
          aria-controls={stepsId}
          onClick={() => setStepsOpen(!showSteps)}
        >
          {showSteps ? t("accounting.fxGuide.hideSteps") : t("accounting.fxGuide.showSteps")}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", showSteps && "rotate-180")}
            aria-hidden="true"
          />
        </Button>
      </div>

      {explainOpen && (
        <ul
          id={explainId}
          className="m-0 mt-3 list-disc space-y-1 border-t border-border ps-9 pt-3 text-xs text-muted-foreground text-pretty"
        >
          {EXPLAIN_KEYS.map((key) => (
            <li key={key}>{t(key, { currency: functionalCurrency })}</li>
          ))}
        </ul>
      )}

      {showSteps && (
        <ol
          id={stepsId}
          className="m-0 mt-2 list-none divide-y divide-border border-t border-border p-0"
        >
          {readiness.steps.map((step, index) => (
            <FxSetupGuideStep
              key={step.id}
              step={step}
              index={index}
              onAction={navigate ? () => navigate(STEP_TARGETS[step.id]) : undefined}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

import type React from "react";
import { CheckCircle2, Circle, Loader2, ShieldAlert } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { FxSetupStep } from "../lib/fxSetupReadiness";

const ACCOUNT_LABEL_KEYS: Record<string, AppTranslationKey> = {
  fxRealizedAccountId: "accounting.settings.fields.fxRealizedAccount",
  fxUnrealizedAccountId: "accounting.settings.fields.fxUnrealizedAccount",
  fxRoundingAccountId: "accounting.settings.fields.fxRoundingAccount",
};

interface FxSetupGuideStepProps {
  step: FxSetupStep;
  index: number;
  /** Jump to where the step is done; omitted when there is nowhere to go. */
  onAction?: () => void;
}

/** One checklist row: status, why it matters, what is missing, and who can fix it. */
export function FxSetupGuideStep({
  step,
  index,
  onAction,
}: FxSetupGuideStepProps): React.JSX.Element {
  const { t } = useTranslation();
  const prefix = `accounting.fxGuide.step.${step.id}` as const;
  const missingLabel =
    step.id === "accounts"
      ? step.missing.map((field) => t(ACCOUNT_LABEL_KEYS[field] ?? field)).join(", ")
      : step.missing.join(", ");
  const needsAction = !step.done && !step.pending && !step.blocked;

  let StatusIcon = Circle;
  let statusLabel = t("accounting.fxGuide.todo");
  if (step.done) {
    StatusIcon = CheckCircle2;
    statusLabel = t("accounting.fxGuide.done");
  } else if (step.pending) {
    StatusIcon = Loader2;
    statusLabel = t("accounting.fxGuide.checking");
  }

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
      <StatusIcon
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0",
          step.done ? "text-success" : "text-muted-foreground",
          step.pending && "animate-spin motion-reduce:animate-none",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="m-0 text-sm font-semibold text-foreground">
          <span className="sr-only">{`${statusLabel}: `}</span>
          {`${index + 1}. ${t(`${prefix}.title`)}`}
        </p>
        <p className="m-0 text-xs text-muted-foreground text-pretty">{t(`${prefix}.why`)}</p>
        {step.blocked && (
          <p className="m-0 text-xs text-muted-foreground">
            {t("accounting.fxGuide.step.rates.blocked")}
          </p>
        )}
        {!step.done && missingLabel && (
          <p className="m-0 text-xs font-medium text-warning">
            {step.id === "accounts"
              ? t("accounting.fxGuide.step.accounts.missing", { accounts: missingLabel })
              : t("accounting.fxGuide.step.rates.missing", { currencies: missingLabel })}
          </p>
        )}
        {needsAction && !step.canAct && (
          <p className="m-0 flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold text-foreground">
                {step.owner === "admin"
                  ? t("accounting.fxGuide.needsAdmin")
                  : t("accounting.fxGuide.needsAccess")}
              </span>
              {" — "}
              {t(`${prefix}.ask`)}
            </span>
          </p>
        )}
      </div>
      {needsAction && step.canAct && onAction && (
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onAction}>
          {t(`${prefix}.action`)}
        </Button>
      )}
    </li>
  );
}

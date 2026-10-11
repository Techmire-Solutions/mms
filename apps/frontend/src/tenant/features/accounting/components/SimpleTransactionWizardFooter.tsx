import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

interface SimpleTransactionWizardFooterProps {
  step: number;
  canProceed: boolean;
  hasSelectedType: boolean;
  isSubmitting: boolean;
  submittingStatus: "draft" | "posted" | "posted_and_new" | null;
  onStepChange: (step: number) => void;
  onClose: () => void;
  onSave: (status: "draft" | "posted", recordAnother?: boolean) => void | Promise<void>;
}

export function SimpleTransactionWizardFooter({
  step,
  canProceed,
  hasSelectedType,
  isSubmitting,
  submittingStatus,
  onStepChange,
  onClose,
  onSave,
}: SimpleTransactionWizardFooterProps) {
  const { t } = useTranslation();

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => (step > 1 ? onStepChange(step - 1) : onClose())}
      >
        {step === 1 ? (
          <>
            <X className="h-4 w-4" aria-hidden="true" />
            {t("accounting.journal.dashboard.wizard.cancel")}
          </>
        ) : (
          <>
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            {t("accounting.journal.dashboard.wizard.back")}
          </>
        )}
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        {step < 3 && (
          <Button
            type="button"
            onClick={() => onStepChange(step + 1)}
            disabled={!canProceed || !hasSelectedType}
          >
            {t("accounting.journal.dashboard.wizard.next")}{" "}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        )}
        {step === 3 && (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                void onSave("draft");
              }}
              disabled={!canProceed || isSubmitting}
            >
              {submittingStatus === "draft" && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {t("accounting.journal.dashboard.wizard.saveDraft")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void onSave("posted", true);
              }}
              disabled={!canProceed || isSubmitting}
            >
              {submittingStatus === "posted_and_new" && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {t("accounting.journal.dashboard.wizard.postAndNew")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                void onSave("posted");
              }}
              disabled={!canProceed || isSubmitting}
              title={t("accounting.journal.dashboard.wizard.postTransactionHint")}
            >
              {submittingStatus === "posted" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              )}
              {t("accounting.journal.dashboard.wizard.postTransaction")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

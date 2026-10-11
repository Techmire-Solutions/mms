import React, { lazy, Suspense } from "react";
import { QUESTION_BANK_MODULE_MANIFEST } from "@mms/shared";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ModuleTierMotion } from "@/components/ui/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@/components/ui/SetupReadOnlyMessage";
import { ModulePanelSuspenseFallback } from "@/components/ui/ModulePanelSuspenseFallback";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";

const QuestionBankSettings = lazy(
  () => import("@/tenant/features/question-bank/components/QuestionBankSettings"),
);

export interface QuestionBankSetupTierProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const QuestionBankSetupTier = function QuestionBankSetupTier({
  onPrefsDirtyChange,
}: QuestionBankSetupTierProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { canEditSetup } = useModulePermissions(QUESTION_BANK_MODULE_MANIFEST);

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          {!canEditSetup ? (
            <SetupReadOnlyMessage title={t("questionBank.setup.readOnly")} />
          ) : (
            <Suspense fallback={<ModulePanelSuspenseFallback />}>
              <QuestionBankSettings onPrefsDirtyChange={onPrefsDirtyChange} />
            </Suspense>
          )}
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
};

export default QuestionBankSetupTier;

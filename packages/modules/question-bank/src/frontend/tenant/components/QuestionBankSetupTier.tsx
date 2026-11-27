import React, { lazy, Suspense } from "react";
import { QUESTION_BANK_MODULE_MANIFEST } from "@mms/contracts";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@mms/ui/app/SetupReadOnlyMessage";
import { ModulePanelSuspenseFallback } from "@mms/fe-core/components/ModulePanelSuspenseFallback";
import { useTranslation } from "@mms/fe-core/i18n";
import { useModulePermissions } from "../host/usePermissions";

const QuestionBankSettings: React.ComponentType<any> = lazy(() => import("./QuestionBankSettings"));

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

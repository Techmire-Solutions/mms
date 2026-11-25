import React, { lazy, Suspense } from "react";
import { ENROLLMENTS_MODULE_MANIFEST } from "@mms/contracts";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@mms/ui/app/SetupReadOnlyMessage";
import { useTranslation } from "@mms/fe-core/i18n";
import { useModulePermissions } from "../host/usePermissions";
import { ModulePanelSuspenseFallback } from "@mms/fe-core/components/ModulePanelSuspenseFallback";

const EnrollmentsSettings = lazy(() => import("./EnrollmentsSettings"));

export interface EnrollmentsSetupTierProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const EnrollmentsSetupTier = function EnrollmentsSetupTier({
  onPrefsDirtyChange,
}: EnrollmentsSetupTierProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { canEditSetup } = useModulePermissions(ENROLLMENTS_MODULE_MANIFEST);

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          {!canEditSetup ? (
            <SetupReadOnlyMessage title={t("enrollments.setup.readOnly")} />
          ) : (
            <Suspense fallback={<ModulePanelSuspenseFallback />}>
              <EnrollmentsSettings onPrefsDirtyChange={onPrefsDirtyChange} />
            </Suspense>
          )}
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
};

export default EnrollmentsSetupTier;

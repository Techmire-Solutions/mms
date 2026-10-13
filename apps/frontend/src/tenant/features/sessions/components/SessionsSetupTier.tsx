import React, { lazy, Suspense } from "react";
import { SESSIONS_MODULE_MANIFEST } from "@mms/shared";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@/components/app/SetupReadOnlyMessage";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { ModulePanelSuspenseFallback } from "@/components/app/ModulePanelSuspenseFallback";

const SessionsSettings = lazy(
  () => import("@/tenant/features/sessions/components/SessionsSettings"),
);

export interface SessionsSetupTierProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const SessionsSetupTier = function SessionsSetupTier({
  onPrefsDirtyChange,
}: SessionsSetupTierProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { canEditSetup } = useModulePermissions(SESSIONS_MODULE_MANIFEST);

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          {!canEditSetup ? (
            <SetupReadOnlyMessage title={t("sessions.setup.readOnly")} />
          ) : (
            <Suspense fallback={<ModulePanelSuspenseFallback />}>
              <SessionsSettings onPrefsDirtyChange={onPrefsDirtyChange} />
            </Suspense>
          )}
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
};

export default SessionsSetupTier;

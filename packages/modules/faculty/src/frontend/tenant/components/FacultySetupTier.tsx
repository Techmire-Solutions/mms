import React, { lazy, Suspense } from "react";
import { FACULTY_MODULE_MANIFEST } from "@mms/contracts";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import { ModulePanelSuspenseFallback } from "@mms/fe-core/components/ModulePanelSuspenseFallback";
import { SetupReadOnlyMessage } from "@mms/ui/app/SetupReadOnlyMessage";
import { useTranslation } from "@mms/fe-core/i18n";
import { useModulePermissions } from "../hooks/usePermissions";

const FacultySettings = lazy(() =>
  import("./FacultySettings").then((m) => ({
    default: m.FacultySettings,
  })),
);

export interface FacultySetupTierProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const FacultySetupTier = function FacultySetupTier({
  onPrefsDirtyChange,
}: FacultySetupTierProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { canEditSetup } = useModulePermissions(FACULTY_MODULE_MANIFEST);

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          {!canEditSetup ? (
            <SetupReadOnlyMessage title={t("faculty.setup.readOnly")} />
          ) : (
            <Suspense fallback={<ModulePanelSuspenseFallback />}>
              <FacultySettings onPrefsDirtyChange={onPrefsDirtyChange} />
            </Suspense>
          )}
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
};

export default FacultySetupTier;

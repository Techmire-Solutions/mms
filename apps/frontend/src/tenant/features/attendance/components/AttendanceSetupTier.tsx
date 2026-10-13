import React, { lazy, Suspense } from "react";
import { ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@/components/app/SetupReadOnlyMessage";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { ModulePanelSuspenseFallback } from "@/components/app/ModulePanelSuspenseFallback";

const AttendanceSettings = lazy(
  () => import("@/tenant/features/attendance/components/AttendanceSettings"),
);

export interface AttendanceSetupTierProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const AttendanceSetupTier = function AttendanceSetupTier({
  onPrefsDirtyChange,
}: AttendanceSetupTierProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { canEditSetup } = useModulePermissions(ATTENDANCE_MODULE_MANIFEST);

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          {!canEditSetup ? (
            <SetupReadOnlyMessage title={t("attendance.settings.readOnly")} />
          ) : (
            <Suspense fallback={<ModulePanelSuspenseFallback />}>
              <AttendanceSettings onPrefsDirtyChange={onPrefsDirtyChange} />
            </Suspense>
          )}
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
};

export default AttendanceSetupTier;

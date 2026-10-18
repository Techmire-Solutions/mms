import React, { lazy, Suspense, useRef } from "react";
import { ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ModuleTierMotion } from "@/components/ui/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@/components/ui/SetupReadOnlyMessage";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { ModulePanelSuspenseFallback } from "@/components/ui/ModulePanelSuspenseFallback";
import { SubTabBar } from "@/components/ui/SubTabBar";
import { ConfirmAlertDialog } from "@/components/ui/ConfirmAlertDialog";
import { useModuleSetupSubTabs } from "@/lib/setup/useModuleSetupSubTabs";

const AttendanceSettings = lazy(
  () => import("@/tenant/features/attendance/components/AttendanceSettings"),
);
const AcademicCalendarManager = lazy(() =>
  import("@/tenant/features/attendance/components/calendar/AcademicCalendarManager").then((m) => ({ default: m.AcademicCalendarManager })),
);

export interface AttendanceSetupTierProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const AttendanceSetupTier = (function AttendanceSetupTier({
  onPrefsDirtyChange,
}: AttendanceSetupTierProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { canEditSetup, canDelete } = useModulePermissions(ATTENDANCE_MODULE_MANIFEST);
  const prefsDirtyRef = useRef(false);
  const subTabs = useModuleSetupSubTabs({
    initialKey: ATTENDANCE_MODULE_MANIFEST.setupSubTabs[0],
    isDirty: (key: string) => key === "preferences" && prefsDirtyRef.current,
    onDiscard: (key: string) => {
      if (key !== "preferences") return;
      prefsDirtyRef.current = false;
      onPrefsDirtyChange?.(false);
    },
  });
  const handlePrefsDirtyChange = (dirty: boolean) => {
    prefsDirtyRef.current = dirty;
    onPrefsDirtyChange?.(dirty);
  };
  const tabs = ATTENDANCE_MODULE_MANIFEST.setupSubTabs.map((key) => ({ key, label: t(`attendance.setup.${key}`) }));

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          <SubTabBar tabs={tabs} value={subTabs.sub} onChange={subTabs.handleSubTabChange} />
          {!canEditSetup ? <SetupReadOnlyMessage title={t("attendance.settings.readOnly")} /> : null}
          <Suspense fallback={<ModulePanelSuspenseFallback />}>
            {subTabs.sub === "calendar" ? (
              <AcademicCalendarManager canWrite={canEditSetup} canDelete={canEditSetup && canDelete} />
            ) : null}
            {subTabs.sub === "preferences" && canEditSetup ? (
              <AttendanceSettings onPrefsDirtyChange={handlePrefsDirtyChange} />
            ) : null}
          </Suspense>
          <ConfirmAlertDialog
            open={subTabs.discardConfirmOpen}
            onOpenChange={(open) => {
              if (!open) subTabs.clearPendingSubTab();
            }}
            title={t("settings.unsavedChanges")}
            description={t("attendance.setup.unsavedPreferencesWarning")}
            confirmLabel={t("common.yes")}
            cancelLabel={t("common.cancel")}
            destructive
            onConfirm={subTabs.handleConfirmDiscard}
          />
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
});

export default AttendanceSetupTier;

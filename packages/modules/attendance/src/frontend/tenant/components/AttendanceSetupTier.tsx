import React, { lazy, Suspense, useRef } from "react";
import { ATTENDANCE_MODULE_MANIFEST } from "@mms/contracts";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@mms/ui/app/SetupReadOnlyMessage";
import { useTranslation } from "@mms/fe-core/i18n";
import { useModulePermissions } from "../host/usePermissions";
import { ModulePanelSuspenseFallback } from "@mms/fe-core/components/ModulePanelSuspenseFallback";
import { SubTabBar } from "@mms/ui/app/SubTabBar";
import { ConfirmAlertDialog } from "@mms/fe-core/components/ConfirmAlertDialog";
import { useModuleSetupSubTabs } from "@mms/fe-core/hooks/useModuleSetupSubTabs";

const AttendanceSettings = lazy(() => import("./AttendanceSettings"));
const AcademicCalendarManager = lazy(() =>
  import("./calendar/AcademicCalendarManager").then((m) => ({
    default: m.AcademicCalendarManager,
  })),
);

export interface AttendanceSetupTierProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const AttendanceSetupTier = function AttendanceSetupTier({
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
  const tabs = ATTENDANCE_MODULE_MANIFEST.setupSubTabs.map((key) => ({
    key,
    label: t(`attendance.setup.${key}` as any),
  }));

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          <SubTabBar tabs={tabs} value={subTabs.sub} onChange={subTabs.handleSubTabChange} />
          {!canEditSetup ? (
            <SetupReadOnlyMessage title={t("attendance.settings.readOnly")} />
          ) : null}
          <Suspense fallback={<ModulePanelSuspenseFallback />}>
            {subTabs.sub === "calendar" ? (
              <AcademicCalendarManager
                canWrite={canEditSetup}
                canDelete={canEditSetup && canDelete}
              />
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
};

export default AttendanceSetupTier;

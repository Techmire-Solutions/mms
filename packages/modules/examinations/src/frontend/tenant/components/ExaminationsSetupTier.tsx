import React, { lazy, Suspense, useState } from "react";
import { EXAMINATIONS_MODULE_MANIFEST } from "@mms/contracts";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@mms/ui/app/SetupReadOnlyMessage";
import { SubTabBar } from "@mms/ui/app/SubTabBar";
import { ModulePanelSuspenseFallback } from "@mms/fe-core/components/ModulePanelSuspenseFallback";
import { useTranslation } from "@mms/fe-core/i18n";
import { useModulePermissions } from "../host/usePermissions";
import { useModuleSetupSubTabs } from "@mms/fe-core/hooks/useModuleSetupSubTabs";
import { useTemplateDraftGuard } from "@mms/fe-core/hooks/useTemplateDraftGuard";

const ExaminationsSettings: React.ComponentType<any> = lazy(() => import("./ExaminationsSettings"));

const ExaminationTemplateEditor: React.ComponentType<any> = lazy(
  () => import("./ExaminationTemplateEditor"),
);

export interface ExaminationsSetupTierProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const ExaminationsSetupTier = function ExaminationsSetupTier({
  onPrefsDirtyChange,
}: ExaminationsSetupTierProps = {}): React.JSX.Element {
  const reportPrefsDirty = (dirty: boolean): void => {
    setPrefsDirty(dirty);
    onPrefsDirtyChange?.(dirty);
  };
  const { t } = useTranslation();
  const { canEditSetup } = useModulePermissions(EXAMINATIONS_MODULE_MANIFEST);
  const templateGuard = useTemplateDraftGuard();
  const [prefsDirty, setPrefsDirty] = useState(false);

  const subTabs = useModuleSetupSubTabs({
    initialKey: "preferences",
    isDirty: (currentKey: string) =>
      (currentKey === "templates" && templateGuard.isDirty()) ||
      (currentKey === "preferences" && prefsDirty),
    onDiscard: (leavingKey: string) => {
      if (leavingKey === "templates") templateGuard.discard();
      // Preferences discard on leaving = unmount the editor, which reloads the saved settings.
    },
    onChange: () => {},
  });

  const tabs = [
    { key: "preferences", label: t("examinations.setup.preferences") },
    { key: "templates", label: t("examinations.setup.templates") },
  ];

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          <SubTabBar tabs={tabs} value={subTabs.sub} onChange={subTabs.handleSubTabChange} />

          {!canEditSetup ? (
            <SetupReadOnlyMessage title={t("examinations.setup.readOnly")} />
          ) : (
            <Suspense fallback={<ModulePanelSuspenseFallback />}>
              {subTabs.sub === "preferences" && (
                <ExaminationsSettings onPrefsDirtyChange={reportPrefsDirty} />
              )}
              {subTabs.sub === "templates" && (
                <ExaminationTemplateEditor
                  key={templateGuard.resetNonce}
                  onDirtyChange={templateGuard.markDirty}
                  onClose={() => subTabs.handleSubTabChange("preferences")}
                />
              )}
            </Suspense>
          )}
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
};

export default ExaminationsSetupTier;

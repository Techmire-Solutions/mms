import React, { lazy, Suspense, useState } from "react";
import { EXAMINATIONS_MODULE_MANIFEST } from "@mms/shared";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@/components/app/SetupReadOnlyMessage";
import { SubTabBar } from "@/components/app/SubTabBar";
import { ModulePanelSuspenseFallback } from "@/components/app/ModulePanelSuspenseFallback";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useModuleSetupSubTabs } from "@/lib/setup/useModuleSetupSubTabs";
import { useTemplateDraftGuard } from "@/lib/setup/useTemplateDraftGuard";

const ExaminationsSettings = lazy(
  () => import("@/tenant/features/examinations/components/ExaminationsSettings"),
);

const ExaminationTemplateEditor = lazy(
  () => import("@/tenant/features/examinations/components/ExaminationTemplateEditor"),
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

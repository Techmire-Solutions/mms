import React, { lazy, Suspense } from "react";
import { EXAMINATIONS_MODULE_MANIFEST } from "@mms/shared";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ModuleTierMotion } from "@/components/ui/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@/components/ui/SetupReadOnlyMessage";
import { SubTabBar } from "@/components/ui/SubTabBar";
import { ModulePanelSuspenseFallback } from "@/components/ui/ModulePanelSuspenseFallback";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useModuleSetupSubTabs } from "@/lib/setup/useModuleSetupSubTabs";

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
  const { t } = useTranslation();
  const { canEditSetup } = useModulePermissions(EXAMINATIONS_MODULE_MANIFEST);

  const subTabs = useModuleSetupSubTabs({
    initialKey: "preferences",
    isDirty: () => false,
    onDiscard: () => {},
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
                <ExaminationsSettings onPrefsDirtyChange={onPrefsDirtyChange} />
              )}
              {subTabs.sub === "templates" && <ExaminationTemplateEditor />}
            </Suspense>
          )}
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
};

export default ExaminationsSetupTier;

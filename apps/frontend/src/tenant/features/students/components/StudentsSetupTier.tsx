import React, { lazy, Suspense, useMemo, useState } from "react";
import { STUDENTS_MODULE_MANIFEST } from "@mms/shared";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ModuleTierMotion } from "@/components/ui/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@/components/ui/SetupReadOnlyMessage";
import { SubTabBar } from "@/components/ui/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { ModulePanelSuspenseFallback } from "@/components/ui/ModulePanelSuspenseFallback";
import { useModuleSetupSubTabs } from "@/lib/setup/useModuleSetupSubTabs";

const StudentsSetupPanel = lazy(
  () => import("@/tenant/features/students/components/StudentsSetupPanel"),
);

const StudentCardTemplateEditor = lazy(
  () => import("@/tenant/features/students/components/card-template/StudentCardTemplateEditor"),
);

export interface StudentsSetupTierProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
}

export const StudentsSetupTier = function StudentsSetupTier({
  onPrefsDirtyChange,
  activeSubTab,
  onSubTabChange,
}: StudentsSetupTierProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { canEditSetup } = useModulePermissions(STUDENTS_MODULE_MANIFEST);
  const [prefsDirty, setPrefsDirty] = useState(false);

  const handlePrefsDirty = (dirty: boolean) => {
    setPrefsDirty(dirty);
    onPrefsDirtyChange?.(dirty);
  };

  const subTabs = useModuleSetupSubTabs({
    initialKey: activeSubTab || "preferences",
    isDirty: (key) => key === "preferences" && prefsDirty,
    onDiscard: () => setPrefsDirty(false),
    onChange: onSubTabChange,
  });

  const subTabBarItems = useMemo(
    () => [
      { key: "preferences", label: t("students.setup.preferences") },
      { key: "card_template", label: t("students.setup.cardTemplate") },
    ],
    [t],
  );

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          <SubTabBar
            tabs={subTabBarItems}
            value={subTabs.sub}
            onChange={subTabs.handleSubTabChange}
          />

          {!canEditSetup ? (
            <SetupReadOnlyMessage title={t("students.setup.readOnly")} />
          ) : (
            <Suspense fallback={<ModulePanelSuspenseFallback />}>
              {subTabs.sub === "preferences" && (
                <StudentsSetupPanel onPrefsDirtyChange={handlePrefsDirty} />
              )}
              {subTabs.sub === "card_template" && (
                <StudentCardTemplateEditor
                  fullscreen={false}
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

export default StudentsSetupTier;

import React, { lazy, Suspense, useMemo, useState } from "react";
import { STUDENTS_MODULE_MANIFEST } from "@mms/shared";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@/components/app/SetupReadOnlyMessage";
import { SubTabBar } from "@/components/app/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { ModulePanelSuspenseFallback } from "@/components/app/ModulePanelSuspenseFallback";
import { useModuleSetupSubTabs } from "@/lib/setup/useModuleSetupSubTabs";
import { useTemplateDraftGuard } from "@/lib/setup/useTemplateDraftGuard";

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

  const templateGuard = useTemplateDraftGuard();

  const subTabs = useModuleSetupSubTabs({
    initialKey: activeSubTab || "preferences",
    isDirty: (key) =>
      (key === "preferences" && prefsDirty) || (key === "card_template" && templateGuard.isDirty()),
    onDiscard: (leavingKey) => {
      if (leavingKey === "preferences") setPrefsDirty(false);
      if (leavingKey === "card_template") templateGuard.discard();
    },
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
                  key={templateGuard.resetNonce}
                  fullscreen={false}
                  onDirtyChange={templateGuard.markDirty}
                  onClose={() => subTabs.handleSubTabChange("preferences")}
                />
              )}
            </Suspense>
          )}
        </div>

        {/* The sub-tab hook refuses to switch away from a dirty tab and waits for the
            consumer to confirm; without this dialog the click was a no-op
            (2026-11-04 review, M4). */}
        <ConfirmAlertDialog
          open={subTabs.discardConfirmOpen}
          onOpenChange={(open) => {
            if (!open) subTabs.clearPendingSubTab();
          }}
          title={t("settings.unsavedChanges")}
          description={t("students.setup.discardUnsavedPreferencesConfirm")}
          confirmLabel={t("common.yes")}
          cancelLabel={t("common.cancel")}
          destructive
          onConfirm={subTabs.handleConfirmDiscard}
        />
      </ErrorBoundary>
    </ModuleTierMotion>
  );
};

export default StudentsSetupTier;

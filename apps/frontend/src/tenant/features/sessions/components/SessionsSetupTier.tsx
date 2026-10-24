import React, { lazy, Suspense, useRef } from "react";
import { SESSIONS_MODULE_MANIFEST, type AcademicCatalogKind } from "@mms/shared";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@/components/app/SetupReadOnlyMessage";
import { SubTabBar } from "@/components/app/SubTabBar";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { ModulePanelSuspenseFallback } from "@/components/app/ModulePanelSuspenseFallback";
import { useModuleSetupSubTabs } from "@/lib/setup/useModuleSetupSubTabs";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";

const SessionsSettings = lazy(
  () => import("@/tenant/features/sessions/components/SessionsSettings"),
);
const SessionsTerminologySettings = lazy(
  () => import("@/tenant/features/sessions/components/SessionsTerminologySettings"),
);
const CatalogListManager = lazy(() =>
  import("@/components/common/catalog/CatalogListManager").then((m) => ({
    default: m.CatalogListManager,
  })),
);

type SessionsSetupSubTab = (typeof SESSIONS_MODULE_MANIFEST.setupSubTabs)[number];

const CATALOG_BY_SUB_TAB: Partial<Record<SessionsSetupSubTab, AcademicCatalogKind>> = {
  categories: "categories",
  programs: "programs",
  subjects: "subjects",
};

export interface SessionsSetupTierProps {
  /** Reports Preferences draft dirtiness to the Setup shell (leave-guard). */
  onPrefsDirtyChange?: (isDirty: boolean) => void;
}

export const SessionsSetupTier = function SessionsSetupTier({
  onPrefsDirtyChange,
}: SessionsSetupTierProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { canEditSetup, canDelete } = useModulePermissions(SESSIONS_MODULE_MANIFEST);
  const prefsDirtyRef = useRef(false);

  const subTabs = useModuleSetupSubTabs({
    initialKey: SESSIONS_MODULE_MANIFEST.setupSubTabs[0],
    // Preferences and Terminology both edit `session_module_preferences` drafts.
    isDirty: (key: string) =>
      (key === "preferences" || key === "terminology") && prefsDirtyRef.current,
    onDiscard: (key: string) => {
      if (key !== "preferences" && key !== "terminology") return;
      prefsDirtyRef.current = false;
      onPrefsDirtyChange?.(false);
    },
  });

  const handlePrefsDirtyChange = (dirty: boolean) => {
    prefsDirtyRef.current = dirty;
    onPrefsDirtyChange?.(dirty);
  };

  const tabs = SESSIONS_MODULE_MANIFEST.setupSubTabs.map((key) => ({
    key,
    label: t(`sessions.setup.${key}`),
  }));
  const catalog = CATALOG_BY_SUB_TAB[subTabs.sub as SessionsSetupSubTab];

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-4">
          <SubTabBar tabs={tabs} value={subTabs.sub} onChange={subTabs.handleSubTabChange} />
          {!canEditSetup ? <SetupReadOnlyMessage title={t("sessions.setup.readOnly")} /> : null}
          <Suspense fallback={<ModulePanelSuspenseFallback />}>
            {catalog ? (
              <CatalogListManager
                key={catalog}
                kind={catalog}
                canWrite={canEditSetup}
                canDelete={canEditSetup && canDelete}
              />
            ) : null}
            {subTabs.sub === "terminology" && canEditSetup ? (
              <SessionsTerminologySettings onDirtyChange={handlePrefsDirtyChange} />
            ) : null}
            {subTabs.sub === "preferences" && canEditSetup ? (
              <SessionsSettings onPrefsDirtyChange={handlePrefsDirtyChange} />
            ) : null}
          </Suspense>
          <ConfirmAlertDialog
            open={subTabs.discardConfirmOpen}
            onOpenChange={(open) => {
              if (!open) subTabs.clearPendingSubTab();
            }}
            title={t("settings.unsavedChanges")}
            description={t("sessions.setup.unsavedPreferencesWarning")}
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

export default SessionsSetupTier;

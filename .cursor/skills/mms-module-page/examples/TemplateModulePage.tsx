import React, { lazy, Suspense } from "react";
import { ModulePageShell } from "@mms/fe-core/components/ModulePageShell";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import { useFilteredModuleTierTabs } from "@mms/fe-core/lib/useModuleTierTabs";
import { usePersistedTabState } from "@mms/fe-core/lib/usePersistedTabState";
import { useDirectoryTrashState } from "@mms/fe-core/lib/useDirectoryTrashState";

interface TemplateModulePageProps {
  titleKey: string;
  canViewReports?: boolean;
  canViewSetup?: boolean;
  workComponent: React.ReactNode;
  reportsComponent?: React.ComponentType;
  setupComponent?: React.ComponentType;
}

/**
 * Standard Production Template for a 3-Tier MMS Module Page.
 *
 * Demonstrates:
 * 1. Persistent tier tab state with `usePersistedTabState`.
 * 2. Soft-delete trash mode synchronization (?view=trash).
 * 3. Permitted tier filtering with `useFilteredModuleTierTabs`.
 * 4. Lazy-loaded non-primary tiers wrapped in `Suspense` and `ModuleTierMotion`.
 */
export function TemplateModulePage({
  titleKey,
  canViewReports = false,
  canViewSetup = false,
  workComponent,
  reportsComponent: ReportsComponent,
  setupComponent: SetupComponent,
}: TemplateModulePageProps) {
  const [activeTab, setActiveTab] = usePersistedTabState(`${titleKey}:tier`, "work");
  const { isTrash } = useDirectoryTrashState();

  const tabs = useFilteredModuleTierTabs({
    canViewReports,
    canViewSetup,
    workLabelKey: titleKey,
  });

  return (
    <ModulePageShell
      titleKey={titleKey}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "work" && (
        <ModuleTierMotion tier={isTrash ? "trash" : "work"}>
          {workComponent}
        </ModuleTierMotion>
      )}

      {activeTab === "reports" && ReportsComponent && (
        <Suspense fallback={<div className="p-8 text-center text-muted">Loading reports...</div>}>
          <ModuleTierMotion tier="reports">
            <ReportsComponent />
          </ModuleTierMotion>
        </Suspense>
      )}

      {activeTab === "setup" && SetupComponent && (
        <Suspense fallback={<div className="p-8 text-center text-muted">Loading preferences...</div>}>
          <ModuleTierMotion tier="setup">
            <SetupComponent />
          </ModuleTierMotion>
        </Suspense>
      )}
    </ModulePageShell>
  );
}

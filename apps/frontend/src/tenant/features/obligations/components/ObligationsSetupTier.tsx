import React, { lazy, Suspense, useMemo } from "react";
import type {
  ObligationDistribution,
  ObligationType,
  Mujtahid,
  MujtahidRep,
  WakalaType,
} from "@mms/shared";
import { SubTabBar } from "@/components/app/SubTabBar";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { SetupReadOnlyMessage } from "@/components/app/SetupReadOnlyMessage";
import { ModulePanelSuspenseFallback } from "@/components/app/ModulePanelSuspenseFallback";
import { useModuleSetupSubTabs } from "@/lib/setup/useModuleSetupSubTabs";
import { useTemplateDraftGuard } from "@/lib/setup/useTemplateDraftGuard";

const WakalaTypeManager = lazy(() =>
  import("@/tenant/features/obligations/components/WakalaTypeManager").then((m) => ({
    default: m.WakalaTypeManager,
  })),
);

const InvoiceTemplateEditor = lazy(() =>
  import("@/tenant/features/obligations/components/invoice/InvoiceTemplateEditor").then((m) => ({
    default: m.InvoiceTemplateEditor,
  })),
);

const ObligationsReceiptNumberingSection = lazy(() =>
  import("@/tenant/features/obligations/components/ObligationsReceiptNumberingSection").then(
    (m) => ({ default: m.ObligationsReceiptNumberingSection }),
  ),
);

export interface SetupTab {
  id: string;
  label: string;
}

export interface ObligationsSetupTierProps {
  tabs: SetupTab[];
  activeTab: string;
  canEditSetup: boolean;
  obligationTypes: ObligationType[];
  mujtahids: Mujtahid[];
  reps: MujtahidRep[];
  wakalaTypes: WakalaType[];
  distributions: ObligationDistribution[];
  onTabChange: (tab: string) => void;
  onChangeTypes: (types: ObligationType[]) => Promise<void>;
  onChangeMujtahids: (mujtahids: Mujtahid[]) => Promise<void>;
  onChangeReps: (reps: MujtahidRep[]) => Promise<void>;
  onChangeWakala: (wakalaTypes: WakalaType[]) => Promise<void>;
  onChangeDistributions: (distributions: ObligationDistribution[]) => Promise<void>;
}

export function ObligationsSetupTier({
  tabs = [],
  activeTab,
  canEditSetup,
  obligationTypes,
  mujtahids,
  reps,
  wakalaTypes,
  distributions,
  onTabChange,
  onChangeTypes,
  onChangeMujtahids,
  onChangeReps,
  onChangeWakala,
  onChangeDistributions,
}: ObligationsSetupTierProps): React.JSX.Element {
  const { t } = useTranslation();

  const templateGuard = useTemplateDraftGuard();
  const subTabs = useModuleSetupSubTabs({
    initialKey: activeTab || "wakala",
    isDirty: (currentKey: string) => currentKey === "invoice_template" && templateGuard.isDirty(),
    onDiscard: (leavingKey: string) => {
      if (leavingKey === "invoice_template") templateGuard.discard();
    },
    onChange: onTabChange,
  });

  const subTabBarItems = useMemo(
    () => tabs.map((tab) => ({ key: tab.id, label: tab.label })),
    [tabs],
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
            <SetupReadOnlyMessage title={t("obligations.setup.readOnly")} />
          ) : (
            <Suspense fallback={<ModulePanelSuspenseFallback />}>
              {subTabs.sub === "wakala" && (
                <WakalaTypeManager
                  wakalaTypes={wakalaTypes}
                  distributions={distributions}
                  obligationTypes={obligationTypes}
                  reps={reps}
                  mujtahids={mujtahids}
                  onChangeWakala={onChangeWakala}
                  onChangeDistributions={onChangeDistributions}
                  onChangeMujtahids={onChangeMujtahids}
                  onChangeReps={onChangeReps}
                  onChangeTypes={onChangeTypes}
                />
              )}

              {subTabs.sub === "numbering" && <ObligationsReceiptNumberingSection />}

              {subTabs.sub === "invoice_template" && (
                <InvoiceTemplateEditor
                  key={templateGuard.resetNonce}
                  fullscreen={false}
                  obligationTypes={obligationTypes}
                  reps={reps}
                  mujtahids={mujtahids}
                  onDirtyChange={templateGuard.markDirty}
                  onClose={() => subTabs.handleSubTabChange("wakala")}
                />
              )}
            </Suspense>
          )}
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
}

export default ObligationsSetupTier;

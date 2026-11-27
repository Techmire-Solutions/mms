import React, { lazy, Suspense, useMemo } from "react";
import type {
  ObligationDistribution,
  ObligationType,
  Mujtahid,
  MujtahidRep,
  WakalaType,
} from "@mms/contracts";
import { SubTabBar } from "@mms/ui/app/SubTabBar";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import { useTranslation } from "@mms/fe-core/i18n";
import { SetupReadOnlyMessage } from "@mms/ui/app/SetupReadOnlyMessage";
import { ModulePanelSuspenseFallback } from "@mms/fe-core/components/ModulePanelSuspenseFallback";
import { useModuleSetupSubTabs } from "@mms/fe-core/hooks/useModuleSetupSubTabs";
import { useTemplateDraftGuard } from "@mms/fe-core/hooks/useTemplateDraftGuard";

const WakalaTypeManager: React.ComponentType<any> = lazy(() =>
  import("./WakalaTypeManager").then((m: any) => ({
    default: m.WakalaTypeManager,
  })),
);

const InvoiceTemplateEditor: React.ComponentType<any> = lazy(() =>
  import("./invoice/InvoiceTemplateEditor").then((m: any) => ({
    default: m.InvoiceTemplateEditor,
  })),
);

const ObligationsReceiptNumberingSection: React.ComponentType<any> = lazy(() =>
  import("./ObligationsReceiptNumberingSection").then((m: any) => ({
    default: m.ObligationsReceiptNumberingSection,
  })),
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
  /** Optional atomic save (wakala + rules in one transaction); the pair above is the fallback. */
  onSaveWakalaAggregate?: (input: {
    wakalaTypes: WakalaType[];
    distributions: ObligationDistribution[];
  }) => Promise<void>;
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
  onSaveWakalaAggregate,
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
    () => tabs.map((tab: any) => ({ key: tab.id, label: tab.label })),
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
                  onSaveAggregate={onSaveWakalaAggregate}
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

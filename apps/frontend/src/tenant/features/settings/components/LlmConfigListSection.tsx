import type React from "react";
import { Brain, Plus, Search } from "lucide-react";
import { SearchBar } from "@/components/app/SearchBar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionCard } from "@/components/app/SectionCard";
import { SettingsCallout } from "@/components/app/SettingsShell";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { LlmConfig, LlmTestResult } from "@mms/shared";
import { LlmConfigCard } from "@/tenant/features/settings/components/LlmConfigCard";
import { LlmConfigTestResultPanel } from "@/tenant/features/settings/components/LlmConfigTestResultPanel";

type LlmHealthStatus = "verified" | "failed" | "testing" | "untested";

interface LlmConfigListSectionProps {
  configs: LlmConfig[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  healthStatuses: Record<string, LlmHealthStatus>;
  testingId: string | null;
  testResult: LlmTestResult | null;
  isGlobalDirty: boolean;
  openAddModal: () => void;
  openEditModal: (config: LlmConfig) => void;
  handleDeleteConfig: (configId: string) => void;
  handleTestConnection: (configId: string) => Promise<void>;
  formatLlmSpeed: (wordCount: number, latencyMs: number) => string;
  t: TranslationFunction;
}

function filterLlmConfigs(configs: LlmConfig[], searchQuery: string): LlmConfig[] {
  const query = searchQuery.toLowerCase().trim();
  if (!query) return configs;
  return configs.filter(
    (config) =>
      config.name.toLowerCase().includes(query) ||
      config.provider.toLowerCase().includes(query) ||
      config.model.toLowerCase().includes(query),
  );
}

export function LlmConfigListSection({
  configs,
  searchQuery,
  setSearchQuery,
  healthStatuses,
  testingId,
  testResult,
  isGlobalDirty,
  openAddModal,
  openEditModal,
  handleDeleteConfig,
  handleTestConnection,
  formatLlmSpeed,
  t,
}: LlmConfigListSectionProps): React.JSX.Element {
  const filtered = filterLlmConfigs(configs, searchQuery);

  return (
    <>
      <SectionCard
        title={t("settings.llmTitle")}
        subtitle={t("settings.llmSubtitle")}
        icon={Brain}
        actions={
          <Button onClick={openAddModal} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> {t("settings.llmAddConfig")}
          </Button>
        }
      >
        <div className="space-y-4">
          <SettingsCallout>{t("settings.llmNotice")}</SettingsCallout>

          {configs.length > 0 && (
            <SearchBar
              placeholder={t("settings.llmSearchPlaceholder")}
              value={searchQuery}
              onChange={setSearchQuery}
              className="w-full"
            />
          )}

          {configs.length === 0 ? (
            <EmptyState
              title={t("settings.llmNoConfigsTitle")}
              description={t("settings.llmNoConfigsDesc")}
              icon={Brain}
              variant="dashed"
            />
          ) : filtered.length === 0 ? (
            <EmptyState title={t("settings.llmNoMatches")} icon={Search} compact />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((config) => (
                <LlmConfigCard
                  key={config.id}
                  config={config}
                  status={healthStatuses[config.id] || "untested"}
                  testingId={testingId}
                  isGlobalDirty={isGlobalDirty}
                  t={t}
                  openEditModal={openEditModal}
                  handleDeleteConfig={handleDeleteConfig}
                  handleTestConnection={handleTestConnection}
                />
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {testResult && (
        <LlmConfigTestResultPanel testResult={testResult} formatLlmSpeed={formatLlmSpeed} t={t} />
      )}
    </>
  );
}

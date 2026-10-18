import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import { sessionLifecycleDisplay } from "@/tenant/features/sessions/hooks/sessionLifecycleDisplay";

interface UseSessionDisplayConfigParams {
  types: string[];
  t: TranslationFunction;
}

export function useSessionDisplayConfig({
  types,
  t,
}: UseSessionDisplayConfigParams) {
  const lifecycle = sessionLifecycleDisplay(t);
  const statusOptions: string[] = lifecycle.statusOptions;
  // Program names from the tenant catalog (Sessions → Setup → Programs).
  const typeOptions = types;

  const statusLabels: Record<string, string> = lifecycle.statusLabels;

  const typeLabels = (() => {
    const sessionTypeLabelsByValue: Record<string, string> = {};
    for (const typeOption of typeOptions) {
      sessionTypeLabelsByValue[typeOption] = typeOption;
    }
    return sessionTypeLabelsByValue;
  })();

  const statusConfig = lifecycle.statusConfig;

  const typeConfig = (() => {
    const config: Record<string, StatusBadgeConfigItem> = {};
    for (const [typeValue, label] of Object.entries(typeLabels)) {
      config[typeValue] = {
        label,
        cls: SEMANTIC_BADGE.info,
      };
    }
    return config;
  })() as Record<string, StatusBadgeConfigItem>;

  return {
    statusOptions,
    typeOptions,
    statusLabels,
    typeLabels,
    statusConfig,
    typeConfig,
  };
}

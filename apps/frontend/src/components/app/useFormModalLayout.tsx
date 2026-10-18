import React from "react";
import { Settings, Eye } from "lucide-react";
import { FormProgressBar } from "@/components/app/FormProgressBar";
import type { SubTab } from "@/components/app/SubTabBar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useDomFormProgress } from "@/components/app/useDomFormProgress";

type FormModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

interface UseFormModalLayoutOptions<K extends string> {
  open: boolean;
  size: FormModalSize;
  tall: boolean;
  progress?: number;
  progressLabel?: React.ReactNode;
  headerExtra?: React.ReactNode;
  tabs?: readonly SubTab<K>[];
  activeTab?: K;
  builderMode: boolean;
  showBuilderToggle: boolean;
  onBuilderModeChange?: (active: boolean) => void;
  panelClassNameProp?: string;
}

export function useFormModalLayout<K extends string>({
  open,
  size,
  tall,
  progress,
  progressLabel,
  headerExtra,
  tabs,
  activeTab,
  builderMode,
  showBuilderToggle,
  onBuilderModeChange,
  panelClassNameProp,
}: UseFormModalLayoutOptions<K>) {
  const { t } = useTranslation();

  const hasTabs = !builderMode && tabs !== undefined && tabs.length > 1 && activeTab !== undefined;

  const {
    progress: domProgress,
    label: domLabel,
    ref: containerRef,
  } = useDomFormProgress(open, !hasTabs && progress === undefined);

  const panelClassName = cn(tall ? "h-modal-tall max-h-modal-tall" : undefined, panelClassNameProp);

  const effectiveSize = ((): FormModalSize => {
    const requested = size ?? (hasTabs ? "xl" : "lg");
    if (requested === "xl" || requested === "2xl" || requested === "3xl") return requested;
    if (hasTabs) return "xl";
    if (tall) return "lg";
    return requested;
  })();

  const activeIndex = (() => {
    if (!tabs || !activeTab) return -1;
    return tabs.findIndex((tab) => tab.key === activeTab);
  })();

  const computedProgress = (() => {
    if (progress !== undefined) return progress;
    if (hasTabs && activeIndex !== -1 && tabs) {
      return Math.round(((activeIndex + 1) / tabs.length) * 100);
    }
    return domProgress;
  })();

  const computedProgressLabel = (() => {
    if (progressLabel !== undefined) return progressLabel;
    if (hasTabs && activeIndex !== -1 && tabs) {
      return `${activeIndex + 1}/${tabs.length}`;
    }
    return domLabel;
  })();

  const resolvedHeaderExtra = (() => {
    if (computedProgress === undefined) return headerExtra;
    const bar = <FormProgressBar value={computedProgress} label={computedProgressLabel} />;
    if (!headerExtra) return bar;
    return (
      <div className="space-y-3">
        {bar}
        {headerExtra}
      </div>
    );
  })();

  const headerActions = (() => {
    if (!showBuilderToggle || !onBuilderModeChange) return null;
    return (
      <Button
        type="button"
        variant={builderMode ? "default" : "outline"}
        onClick={() => onBuilderModeChange(!builderMode)}
        className="text-xs min-h-11 px-2.5 flex items-center gap-1.5 font-bold uppercase tracking-wider transition-all duration-300"
      >
        {builderMode ? (
          <>
            <Eye className="w-3.5 h-3.5" />
            <span>{t("contacts.form.viewForm")}</span>
          </>
        ) : (
          <>
            <Settings className="w-3.5 h-3.5" />
            <span>{t("contacts.form.editForm")}</span>
          </>
        )}
      </Button>
    );
  })();

  return {
    hasTabs,
    containerRef,
    panelClassName,
    effectiveSize,
    resolvedHeaderExtra,
    headerActions,
  };
}

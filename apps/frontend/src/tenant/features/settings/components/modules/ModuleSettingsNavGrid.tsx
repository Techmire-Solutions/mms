import React from "react";
import {
  SYSTEM_MODULE_NAV,
  SYSTEM_MODULES,
  SYSTEM_MODULES_BY_ID,
  translateSystemModuleDescription,
  translateSystemModuleLabel,
  type ModuleDefinition,
  type SystemModuleNavEntry,
} from "@mms/shared";
import { resolveModuleIcon } from "@/lib/config/moduleIcons";
import { useTranslation } from "@/hooks/useTranslation";
import { Switch } from "@/components/ui/switch";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ModuleToggleCardProps {
  module: ModuleDefinition;
  enabled: boolean;
  label: string;
  description: string;
  requiredLabel: string;
  onToggle: (enabled: boolean) => void;
}

function ModuleToggleCard({
  module,
  enabled,
  label,
  description,
  requiredLabel,
  onToggle,
}: ModuleToggleCardProps): React.JSX.Element {
  const Icon = resolveModuleIcon(module.icon);
  const toggleId = `module-toggle-${module.id}`;
  const descId = `module-desc-${module.id}`;

  return (
    <div
      className={cn(
        "flex items-start gap-3.5 rounded-xl border p-3.5 transition-all duration-200",
        enabled
          ? "border-border/80 bg-card shadow-sm hover:border-border"
          : "border-border/40 bg-muted/20 opacity-80 hover:opacity-100",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
          enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <label
              htmlFor={toggleId}
              className="block truncate text-sm font-semibold text-foreground cursor-pointer"
            >
              {label}
            </label>
            <p id={descId} className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {description}
            </p>
          </div>
          {module.required ? (
            <Badge as="span" tone="muted" size="sm">
              {requiredLabel}
            </Badge>
          ) : (
            <Switch
              id={toggleId}
              checked={enabled}
              onCheckedChange={onToggle}
              aria-label={label}
              aria-describedby={descId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface ModuleSettingsNavGridProps {
  enabledModules: Record<string, boolean>;
  grantedModules?: Record<string, boolean>;
  onToggleModule: (moduleId: string, enabled: boolean) => void;
}

/** Renders module toggles in the same layout as app navigation (`SYSTEM_MODULE_NAV`). */
export default function ModuleSettingsNavGrid({
  enabledModules,
  grantedModules,
  onToggleModule,
}: ModuleSettingsNavGridProps): React.JSX.Element {
  const { t, language } = useTranslation();

  const requiredLabel = t("module.system.required");

  const blocks = (() => {
    const moduleLabel = (mod: ModuleDefinition): string =>
      translateSystemModuleLabel(mod.id, language, mod.label);
    const moduleDesc = (mod: ModuleDefinition): string =>
      translateSystemModuleDescription(mod.id, language, mod.description);
    const isEnabled = (moduleId: string): boolean => enabledModules[moduleId] !== false;

    const nodes: React.ReactNode[] = [];
    let standaloneBatch: string[] = [];

    const renderCard = (moduleId: string): React.ReactNode | null => {
      if (grantedModules && grantedModules[moduleId] === false) return null;
      const mod = SYSTEM_MODULES_BY_ID[moduleId];
      if (!mod) return null;
      return (
        <ModuleToggleCard
          key={moduleId}
          module={mod}
          label={moduleLabel(mod)}
          description={moduleDesc(mod)}
          requiredLabel={requiredLabel}
          enabled={isEnabled(moduleId)}
          onToggle={(value) => onToggleModule(moduleId, value)}
        />
      );
    };

    const flushStandalone = (): void => {
      if (standaloneBatch.length === 0) return;
      const moduleIds = [...standaloneBatch];
      standaloneBatch = [];
      nodes.push(
        <div key={`standalone-${moduleIds.join("-")}`} className="grid gap-3 sm:grid-cols-2">
          {moduleIds.map(renderCard)}
        </div>,
      );
    };

    const renderGroup = (entry: Extract<SystemModuleNavEntry, { type: "group" }>): void => {
      const children = entry.moduleIds.map(renderCard).filter(Boolean);
      if (children.length === 0) return;

      const GroupIcon = resolveModuleIcon(entry.icon);
      nodes.push(
        <div
          key={entry.labelKey}
          className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4"
        >
          <div className="flex items-center gap-2 border-b border-border/50 pb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <GroupIcon className="h-3.5 w-3.5 text-primary" aria-hidden />
            </div>
            <h4 className="text-sm font-bold text-foreground">{t(entry.labelKey)}</h4>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{children}</div>
        </div>,
      );
    };

    for (const entry of SYSTEM_MODULE_NAV) {
      if (entry.type === "module") {
        standaloneBatch.push(entry.moduleId);
        if (standaloneBatch.length === 2) flushStandalone();
      } else {
        flushStandalone();
        renderGroup(entry);
      }
    }
    flushStandalone();

    return nodes;
  })();

  const moduleStats = (() => {
    const availableModules = SYSTEM_MODULES.filter(
      (mod) => !grantedModules || grantedModules[mod.id] !== false,
    );
    const total = availableModules.length;
    const enabled = availableModules.filter(
      (moduleDefinition) => enabledModules[moduleDefinition.id] !== false,
    ).length;
    return { total, enabled };
  })();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium" aria-live="polite">
        <Badge as="span" tone="primary" size="sm">
          {t("module.system.stats", {
            enabled: moduleStats.enabled,
            total: moduleStats.total,
          })}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{t("module.system.hint")}</p>
      <div className="space-y-4">{blocks}</div>
    </>
  );
}

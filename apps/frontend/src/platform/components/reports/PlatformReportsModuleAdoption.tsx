import React from "react";
import { SYSTEM_MODULES, type ModuleDefinition } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { ReportChartCard } from "@/components/reports/ReportChartCard";
import { Badge } from "@shared/ui";
import { resolveModuleIcon } from "@/lib/config/moduleIcons";

export function PlatformReportsModuleAdoption(): React.JSX.Element {
  const { t } = useTranslation();

  const grouped = (() => {
    const map = new Map<string, ModuleDefinition[]>();
    for (const mod of SYSTEM_MODULES) {
      const cat = mod.category || "core";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(mod);
    }
    return Array.from(map.entries());
  })();

  return (
    <ReportChartCard
      title={t("platform.reports.moduleAdoption")}
      subtitle={t("platform.reports.moduleAdoptionSub")}
      heightClass="min-h-48"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {grouped.map(([category, modules]) => (
          <div
            key={category}
            className="space-y-2 p-3 rounded-xl border border-border/50 bg-card/40 text-start"
          >
            <div className="flex items-center justify-between pb-1 border-b border-border/40">
              <span className="text-2xs font-black uppercase tracking-wider text-muted-foreground">
                {category}
              </span>
              <Badge as="span" tone="muted" size="sm" pill>
                {modules.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {modules.map((mod) => {
                const Icon = resolveModuleIcon(mod.icon);
                return (
                  <span
                    key={mod.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border/60 bg-muted/40 text-2xs font-medium text-foreground"
                    title={mod.description}
                  >
                    {Icon ? <Icon className="w-3 h-3 text-primary shrink-0" aria-hidden /> : null}
                    <span>{mod.label}</span>
                    {mod.required ? (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-primary"
                        aria-label={t("common.required")}
                      />
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ReportChartCard>
  );
}

import React, { useEffect, useState } from "react";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import { SYSTEM_MODULES } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { FormModal } from "@/components/ui/FormModal";
import { CardSkeleton } from "@/components/ui/LoadingState";
import { PlatformModuleSelectCard } from "@/platform/components/workspace/PlatformModuleSelectCard";
import { PlatformModulePresetsBar } from "@/platform/components/workspace/PlatformModulePresetsBar";
import {
  useUpdateWorkspaceModules,
  useWorkspaceModules,
} from "@/platform/hooks/usePlatformWorkspaces";
import { resolveModuleIcon } from "@/lib/config/moduleIcons";
import { LayoutDashboard, AlertTriangle } from "lucide-react";

interface PlatformWorkspaceModulesDialogProps {
  workspace: PlatformWorkspaceRowData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlatformWorkspaceModulesDialog({
  workspace,
  open,
  onOpenChange,
}: PlatformWorkspaceModulesDialogProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: currentModules, isLoading } = useWorkspaceModules(workspace.subdomain, open);
  const { mutateAsync: updateModules, isPending } = useUpdateWorkspaceModules();

  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  useEffect(() => {
    if (currentModules) {
      setSelectedModules(currentModules);
    }
  }, [currentModules, open]);

  const toggleModule = (moduleId: string, checked: boolean) => {
    setSelectedModules((prev) => {
      const nextSet = new Set(prev);
      if (checked) {
        nextSet.add(moduleId);
      } else {
        nextSet.delete(moduleId);
      }
      return [...nextSet];
    });
  };

  const applyPreset = (moduleIds: string[]) => {
    const requiredIds = SYSTEM_MODULES.filter((m) => m.required).map((m) => m.id);
    const combined = Array.from(new Set([...requiredIds, ...moduleIds]));
    setSelectedModules(combined);
  };

  const handleSave = async () => {
    try {
      await updateModules({ subdomain: workspace.subdomain, modules: selectedModules });
      onOpenChange(false);
    } catch {
      // Error is handled in the mutation
    }
  };

  const categories = (() => {
    const map = new Map<string, typeof SYSTEM_MODULES>();
    for (const mod of SYSTEM_MODULES) {
      const cat = mod.category || "core";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(mod);
    }
    return Array.from(map.entries());
  })();

  const selectedModuleSet = new Set(selectedModules);

  const disabledActiveModules = (() => {
    if (!currentModules || currentModules.length === 0) return [];
    return currentModules.filter((id) => !selectedModuleSet.has(id));
  })();

  return (
    <FormModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={t("platform.modulesTitle")}
      subtitle={`${workspace.madrasaName} (${workspace.subdomain})`}
      icon={LayoutDashboard}
      size="xl"
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      onSave={handleSave}
      saving={isPending}
      saveDisabled={isPending || isLoading}
      dir="ltr"
      lang="en"
      formId="platform-workspace-modules-form"
    >
      <form
        id="platform-workspace-modules-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!isPending && !isLoading) void handleSave();
        }}
        className="flex-1 overflow-y-auto px-1 py-2 text-start space-y-5"
      >
        <PlatformModulePresetsBar onApplyPreset={applyPreset} disabled={isPending} />

        {disabledActiveModules.length > 0 && (
          <div
            className="flex items-start gap-2.5 p-3 rounded-xl border border-warning/40 bg-warning/10 text-xs text-foreground"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" aria-hidden />
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="font-bold text-foreground">
                {t("platform.modulesDisabledWarningTitle")}
              </p>
              <p className="text-3xs text-muted-foreground leading-relaxed">
                {t("platform.modulesDisabledWarningBody", {
                  modules: disabledActiveModules
                    .map((id) => SYSTEM_MODULES.find((m) => m.id === id)?.label || id)
                    .join(", "),
                })}
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <CardSkeleton count={3} />
        ) : (
          <div className="space-y-6">
            {categories.map(([categoryKey, modules]) => (
              <div key={categoryKey} className="space-y-2.5">
                <h4 className="text-2xs font-black uppercase tracking-wider text-muted-foreground px-1">
                  {categoryKey}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {modules.map((module) => {
                    const Icon = resolveModuleIcon(module.icon);
                    const isSelected = selectedModuleSet.has(module.id);
                    return (
                      <PlatformModuleSelectCard
                        key={module.id}
                        module={module}
                        selected={isSelected}
                        disabled={isPending}
                        icon={Icon}
                        onToggle={toggleModule}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </form>
    </FormModal>
  );
}

import React from "react";
import { LayoutDashboard } from "lucide-react";
import { SectionCard } from "@mms/ui";
import { PlatformModuleSelectCard } from "@/platform/features/shell/components/PlatformModuleSelectCard";
import { PlatformModulePresetsBar } from "@/platform/features/workspaces/components/PlatformModulePresetsBar";
import type { CreateMadrasaController } from "@/platform/features/onboarding/steps/useCreateMadrasaController";

interface CreateMadrasaModulesSectionProps {
  controller: CreateMadrasaController;
}

export function CreateMadrasaModulesSection({
  controller,
}: CreateMadrasaModulesSectionProps): React.JSX.Element {
  const { t, data, availableModules, setModules } = controller;
  const availableIds = new Set(availableModules.map((module) => module.id));

  const toggleModule = (moduleId: string, checked: boolean) => {
    if (!availableIds.has(moduleId)) return;
    const next = checked
      ? [...data.modules, moduleId]
      : data.modules.filter((id) => id !== moduleId);
    setModules(next);
  };

  const applyPreset = (moduleIds: string[]) => {
    setModules(moduleIds.filter((id) => availableIds.has(id)));
  };

  return (
    <SectionCard
      title={t("platform.modulesTitle")}
      subtitle={t("platform.modulesSubtitle")}
      icon={LayoutDashboard}
    >
      <div className="space-y-4 text-start">
        {/* Preset Archetype Chips */}
        <PlatformModulePresetsBar onApplyPreset={applyPreset} />

        {/* Module Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {(() => {
            const moduleSet = new Set(data.modules);
            return availableModules.map((module) => (
              <PlatformModuleSelectCard
                key={module.id}
                module={module}
                selected={moduleSet.has(module.id)}
                onToggle={toggleModule}
              />
            ));
          })()}
        </div>
      </div>
    </SectionCard>
  );
}

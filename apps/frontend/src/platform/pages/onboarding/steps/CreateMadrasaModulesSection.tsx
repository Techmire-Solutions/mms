import React from "react";
import { LayoutDashboard } from "lucide-react";
import { SYSTEM_MODULES } from "@mms/shared";
import { SectionCard } from "@/components/ui/SectionCard";
import { PlatformModuleSelectCard } from "@/platform/components/workspace/PlatformModuleSelectCard";
import { PlatformModulePresetsBar } from "@/platform/components/workspace/PlatformModulePresetsBar";
import type { CreateMadrasaController } from "@/platform/pages/onboarding/steps/useCreateMadrasaController";

interface CreateMadrasaModulesSectionProps {
  controller: CreateMadrasaController;
}

export function CreateMadrasaModulesSection({
  controller,
}: CreateMadrasaModulesSectionProps): React.JSX.Element {
  const { t, data, onChange } = controller;

  const toggleModule = (moduleId: string, checked: boolean) => {
    onChange((prev) => {
      const newModules = checked
        ? [...prev.modules, moduleId]
        : prev.modules.filter((id) => id !== moduleId);
      return { ...prev, modules: newModules };
    });
  };

  const applyPreset = (moduleIds: string[]) => {
    // Ensure all required modules stay enabled
    const requiredIds = SYSTEM_MODULES.filter((m) => m.required).map((m) => m.id);
    const combined = Array.from(new Set([...requiredIds, ...moduleIds]));
    onChange((prev) => ({ ...prev, modules: combined }));
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
            return SYSTEM_MODULES.map((module) => (
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

import React, { useId } from "react";
import { FormCheckboxCard } from "@/components/app/FormCheckboxCard";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { ModuleDefinition } from "@mms/shared";

export interface PlatformModuleSelectCardProps {
  module: ModuleDefinition;
  selected: boolean;
  disabled?: boolean;
  icon?: React.ElementType;
  onToggle: (id: string, checked: boolean) => void;
  className?: string;
}

/**
 * Reusable module selection card primitive for platform onboarding and workspace module configuration.
 */
export function PlatformModuleSelectCard({
  module,
  selected,
  disabled = false,
  icon: Icon,
  onToggle,
  className,
}: PlatformModuleSelectCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const inputId = useId();
  const isDisabled = disabled || module.required;

  return (
    <FormCheckboxCard
      id={inputId}
      name={`module-${module.id}`}
      checked={selected}
      disabled={isDisabled}
      onCheckedChange={(checked) => onToggle(module.id, checked)}
      className={className}
      description={module.description}
      label={
        <span className="flex flex-wrap items-center gap-1.5">
          {Icon ? (
            <Icon
              className={cn(
                "w-3.5 h-3.5 shrink-0",
                selected ? "text-primary" : "text-muted-foreground",
              )}
              aria-hidden
            />
          ) : null}
          <span className="text-xs font-bold text-foreground break-words">{module.label}</span>
          {module.required ? (
            <Badge as="span" tone="muted" size="sm" pill className="ms-auto font-semibold">
              {t("platform.moduleRequired")}
            </Badge>
          ) : null}
        </span>
      }
    />
  );
}

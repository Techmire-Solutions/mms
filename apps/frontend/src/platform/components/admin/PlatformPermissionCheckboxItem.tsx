import React, { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { FormCheckboxCard } from "@/components/app/FormCheckboxCard";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";

export interface PlatformPermissionCheckboxItemProps {
  name: string;
  label: string;
  description: string;
  icon: LucideIcon;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function PlatformPermissionCheckboxItem({
  name,
  label,
  description,
  icon: Icon,
  checked,
  disabled = false,
  onChange,
}: PlatformPermissionCheckboxItemProps): React.JSX.Element {
  const { t } = useTranslation();
  const inputId = useId();

  return (
    <FormCheckboxCard
      id={inputId}
      name={name}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      description={description}
      label={
        <span className="flex flex-wrap items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
          <span className="text-xs font-bold text-foreground">{label}</span>
          <Badge
            as="span"
            tone={checked ? "success" : "muted"}
            size="sm"
            pill
            className="ms-auto uppercase tracking-wider text-2xs font-bold"
          >
            {checked ? t("platform.workspaceActive") : t("platform.workspaceInactive")}
          </Badge>
        </span>
      }
    />
  );
}

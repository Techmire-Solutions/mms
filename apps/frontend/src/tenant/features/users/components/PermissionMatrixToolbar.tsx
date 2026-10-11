import React from "react";
import { Check, Search, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";

export interface PermissionMatrixToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalGranted: number;
  totalPossible: number;
  readOnly: boolean;
  hasFilteredModules: boolean;
  allModulesChecked: boolean;
  onToggleGlobalAll: () => void;
}

export function PermissionMatrixToolbar({
  searchQuery,
  onSearchChange,
  totalGranted,
  totalPossible,
  readOnly,
  hasFilteredModules,
  allModulesChecked,
  onToggleGlobalAll,
}: PermissionMatrixToolbarProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 border-b border-border/40">
      <div className="relative flex-1 min-w-search max-w-xs">
        <Search
          className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("common.columns.searchPlaceholder")}
          aria-label={t("common.columns.searchPlaceholder")}
          className="ps-8 pe-3 h-8 text-xs bg-muted/30"
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>
            {totalGranted} / {totalPossible}
          </span>
        </div>
        {!readOnly && hasFilteredModules ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleGlobalAll}
            className="h-8 px-2.5 text-xs font-bold gap-1 rounded-lg border-border cursor-pointer"
            aria-label={allModulesChecked ? t("common.deselect") : t("users.permissions.colAll")}
          >
            {allModulesChecked ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {allModulesChecked ? t("common.deselect") : t("users.permissions.colAll")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

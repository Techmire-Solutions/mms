import type { LucideIcon } from "lucide-react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { WORK_SURFACE } from "@/components/ui/formStyles";

export interface ModuleWorkDirectoryEmptyProps {
  icon: LucideIcon;
  title: string;
  description: string;
  hasActiveFilters: boolean;
  viewingDeleted: boolean;
  onClearFilters: () => void;
  onShowActive?: () => void;
  clearFiltersLabel: string;
  showActiveLabel: string;
}

/** Shared Work directory empty chrome (filters / trash / first-run). */
export function ModuleWorkDirectoryEmpty({
  icon,
  title,
  description,
  hasActiveFilters,
  viewingDeleted,
  onClearFilters,
  onShowActive,
  clearFiltersLabel,
  showActiveLabel,
}: ModuleWorkDirectoryEmptyProps): React.JSX.Element {
  const action = hasActiveFilters ? (
    <Button type="button" variant="outline" size="sm" onClick={onClearFilters} className="gap-1.5">
      <RefreshCw className="w-3 h-3" /> {clearFiltersLabel}
    </Button>
  ) : viewingDeleted && onShowActive ? (
    <Button type="button" variant="outline" size="sm" onClick={onShowActive} className="gap-1.5">
      <RefreshCw className="w-3 h-3" /> {showActiveLabel}
    </Button>
  ) : null;

  return (
    <div className={`${WORK_SURFACE} border-border/40 p-6`}>
      <EmptyState
        variant="dashed"
        icon={icon}
        title={title}
        description={description}
        action={action}
      />
    </div>
  );
}

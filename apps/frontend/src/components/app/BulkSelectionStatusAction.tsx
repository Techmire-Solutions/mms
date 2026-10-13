import type { ReactElement } from "react";
import { ChevronDown, Tag } from "lucide-react";
import { bulkActionDockActionClassName } from "@/components/ui/bulkActionDockStyles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";

export interface BulkSelectionStatusActionProps {
  label: string;
  statuses: readonly string[];
  statusBadgeConfig: Record<string, StatusBadgeConfigItem>;
  onSelectStatus: (status: string) => void;
  /** Disables the trigger while a bulk status mutation is pending. */
  disabled?: boolean;
}

/** Status dropdown action for Work bulk bars (Students / Teachers). */
export function BulkSelectionStatusAction({
  label,
  statuses,
  statusBadgeConfig,
  onSelectStatus,
  disabled = false,
}: BulkSelectionStatusActionProps): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={bulkActionDockActionClassName}
        >
          <Tag className="w-3.5 h-3.5 text-primary" /> {label}{" "}
          <ChevronDown className="w-3 h-3 ms-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {statuses.map((statusVal) => (
          <DropdownMenuItem key={statusVal} onClick={() => onSelectStatus(statusVal)}>
            <StatusBadge status={statusVal} size="sm" config={statusBadgeConfig} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

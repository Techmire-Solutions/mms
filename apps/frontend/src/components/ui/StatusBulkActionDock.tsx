import { Ban, CheckCircle2 } from "lucide-react";
import { WorkActionDock } from "@/components/common/work/WorkActionDock";

export interface StatusBulkActionDockProps {
  selectedCount: number;
  countLabel: string;
  clearLabel: string;
  exportLabel: string;
  enableLabel: string;
  disableLabel: string;
  onClearSelection: () => void;
  onExport: () => void;
  onEnable?: () => void;
  onDisable?: () => void;
  busy?: boolean;
}

export function StatusBulkActionDock({
  selectedCount,
  countLabel,
  clearLabel,
  exportLabel,
  enableLabel,
  disableLabel,
  onClearSelection,
  onExport,
  onEnable,
  onDisable,
  busy = false,
}: StatusBulkActionDockProps) {
  if (selectedCount === 0) return null;
  const transitions = [];
  if (onEnable)
    transitions.push({
      id: "bulk-enable",
      label: enableLabel,
      icon: CheckCircle2,
      tone: "secondary" as const,
      disabled: busy,
      className: "border-success/30 text-success hover:bg-success/10",
      onClick: onEnable,
    });
  if (onDisable)
    transitions.push({
      id: "bulk-disable",
      label: disableLabel,
      icon: Ban,
      tone: "destructive" as const,
      disabled: busy,
      onClick: onDisable,
    });
  return (
    <WorkActionDock
      selectedCount={selectedCount}
      countLabel={countLabel}
      clearLabel={clearLabel}
      onClearSelection={onClearSelection}
      placement="floating"
      tone="glass"
      className="z-elevated"
      exportAction={{ label: exportLabel, onExport }}
      transitions={transitions}
    />
  );
}

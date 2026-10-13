import type React from "react";
import type { BulkSelectionMessageChannel } from "@/components/common/BulkActionDock";
import type {
  BulkActionDockPlacement,
  BulkActionDockTone,
} from "@/components/common/BulkActionDock";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";

export type BulkSelectionPlacement = BulkActionDockPlacement;
export type BulkSelectionTone = BulkActionDockTone;
export type { BulkSelectionMessageChannel };

export interface WorkActionTransition {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "primary" | "destructive" | "outline" | "ghost" | "secondary";
  onClick: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export interface WorkActionDockProps {
  selectedCount: number;
  countLabel: React.ReactNode;
  onClearSelection: () => void;
  clearLabel?: string;

  /** Configurable lifecycle transitions (e.g. Approve, Reject, Mark Attended, Post). */
  transitions?: WorkActionTransition[];

  /** Optional status dropdown selector for batch updates. */
  statusAction?: {
    label: string;
    statuses: readonly string[];
    statusBadgeConfig: Record<string, StatusBadgeConfigItem>;
    onSelectStatus: (status: string) => void;
    disabled?: boolean;
  };

  /** Multi-channel messaging integration. */
  messaging?: {
    onChannel: (channel: BulkSelectionMessageChannel) => void;
    labels: {
      whatsapp: string;
      sms: string;
      email?: string;
    };
    channels?: Partial<Record<BulkSelectionMessageChannel, boolean>>;
  };

  /** Export action. */
  exportAction?: {
    onExport: () => void | Promise<void>;
    label: string;
  };

  /** Delete action. */
  deleteAction?: {
    onDelete: () => void;
    label: string;
  };

  /** Restore action (when viewing trash). */
  restoreAction?: {
    onRestore: () => void;
    label: string;
  };

  placement?: BulkSelectionPlacement;
  tone?: BulkSelectionTone;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
  enableEscapeKey?: boolean;
}

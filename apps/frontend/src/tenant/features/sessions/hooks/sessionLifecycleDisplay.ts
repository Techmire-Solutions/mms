import { SESSION_LIFECYCLE_STATES, type SessionLifecycleState } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";

const LIFECYCLE_TONE: Record<SessionLifecycleState, string> = {
  draft: SEMANTIC_BADGE.muted,
  open: SEMANTIC_BADGE.info,
  in_progress: SEMANTIC_BADGE.success,
  completed: SEMANTIC_BADGE.secondary,
  cancelled: SEMANTIC_BADGE.destructive,
  archived: SEMANTIC_BADGE.muted,
};

/** Lifecycle labels + badge tones (SSOT for session status display across directory, drawer and form). */
export function sessionLifecycleDisplay(t: TranslationFunction): {
  statusOptions: SessionLifecycleState[];
  statusLabels: Record<SessionLifecycleState, string>;
  statusConfig: Record<string, StatusBadgeConfigItem>;
} {
  const statusLabels = {} as Record<SessionLifecycleState, string>;
  const statusConfig: Record<string, StatusBadgeConfigItem> = {};
  for (const state of SESSION_LIFECYCLE_STATES) {
    statusLabels[state] = t(`sessions.lifecycle.${state}`);
    statusConfig[state] = { label: statusLabels[state], cls: LIFECYCLE_TONE[state] };
  }
  return { statusOptions: [...SESSION_LIFECYCLE_STATES], statusLabels, statusConfig };
}

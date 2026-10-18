import { useCallback, useMemo } from "react";
import type { KeyboardEvent } from "react";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";

export interface WorkCardEntity {
  id: string | number;
}

export interface UseWorkCardActionOptions<TEntity extends WorkCardEntity> {
  entity: TEntity;
  /** Currently selected IDs, as an array or Set. */
  selectedIds: Array<string | number> | Set<string | number>;
  /** Multi-card selection toggle callback. */
  onToggleSelected?: (id: TEntity["id"], checked: boolean) => void;
  /** Single-card exclusive selection callback. */
  onSelectOnly?: (id: TEntity["id"]) => void;
  /** Opens the detail drawer / sheet for this entity. */
  onView?: (entity: TEntity) => void;
  /** Opens the edit form for this entity (optional — falls back to onView). */
  onEdit?: (entity: TEntity) => void;
  /** Contextual quick-action executor (e.g. status changes, inline approvals). */
  onQuickAction?: (actionKey: string, entity: TEntity, payload?: unknown) => void | Promise<void>;
  /** Optional status badge dictionary for status metadata derivation. */
  statusConfig?: Record<string, StatusBadgeConfigItem>;
  /** Function to extract the status key for status derivation. */
  getStatusKey?: (entity: TEntity) => string | undefined;
  /** Whether the selection checkbox should be enabled. @default true */
  canSelect?: boolean;
}

export interface UseWorkCardActionReturn<_TEntity extends WorkCardEntity> {
  isSelected: boolean;
  /** Stable toggle handler — passes current !isSelected to onToggleSelected. */
  onSelect: () => void;
  /** Stable exclusive select handler — invokes onSelectOnly with entity.id. */
  onSelectOnly: () => void;
  /** Stable view handler — calls onView(entity) or falls back to onEdit. */
  onView: () => void;
  /** Stable edit handler — calls onEdit(entity) then onView(entity) as fallback. */
  onEdit: () => void;
  /** Contextual quick action executor. */
  executeQuickAction: (actionKey: string, payload?: unknown) => void | Promise<void>;
  /** Derived status badge metadata. */
  statusBadge: { status: string; config?: StatusBadgeConfigItem } | null;
  /**
   * Keyboard handler to attach to the card container:
   * - Space → triggers onSelect (when canSelect)
   * - Enter → triggers onView (or fallback to onEdit)
   */
  onKeyDown: (e: KeyboardEvent) => void;
  /** Pre-configured container props for EntityCard. */
  cardProps: {
    tabIndex?: number;
    role: "article";
    onKeyDown: (e: KeyboardEvent) => void;
    /** Selection is announced via the card checkbox; article does not support aria-selected. */
    "data-selected"?: boolean;
  };
}

/**
 * Per-card adapter for Work directory entity cards.
 *
 * Derives `isSelected`, stabilises selection/action handlers, provides a
 * unified keyboard handler, and derives status metadata — keeping renderItem
 * closures free of interaction logic. Selection state authority remains in
 * the module's controller-owned selection (`useWorkSelection`).
 */
export function useWorkCardAction<TEntity extends WorkCardEntity>({
  entity,
  selectedIds,
  onToggleSelected,
  onSelectOnly,
  onView,
  onEdit,
  onQuickAction,
  statusConfig,
  getStatusKey,
  canSelect = true,
}: UseWorkCardActionOptions<TEntity>): UseWorkCardActionReturn<TEntity> {
  const isSelected = useMemo(() => {
    if (selectedIds instanceof Set) {
      return selectedIds.has(entity.id) || selectedIds.has(String(entity.id));
    }
    return (
      selectedIds.includes(entity.id as never) || selectedIds.includes(String(entity.id) as never)
    );
  }, [selectedIds, entity.id]);

  const handleSelect = useCallback(() => {
    if (!canSelect) return;
    onToggleSelected?.(entity.id, !isSelected);
  }, [canSelect, onToggleSelected, entity.id, isSelected]);

  const handleSelectOnly = useCallback(() => {
    if (!canSelect) return;
    if (onSelectOnly) {
      onSelectOnly(entity.id);
    } else {
      onToggleSelected?.(entity.id, true);
    }
  }, [canSelect, onSelectOnly, onToggleSelected, entity.id]);

  const handleView = useCallback(() => {
    if (onView) {
      onView(entity);
    } else if (onEdit) {
      onEdit(entity);
    }
  }, [onView, onEdit, entity]);

  const handleEdit = useCallback(() => {
    if (onEdit) {
      onEdit(entity);
    } else if (onView) {
      onView(entity);
    }
  }, [onEdit, onView, entity]);

  const executeQuickAction = useCallback(
    (actionKey: string, payload?: unknown) => {
      return onQuickAction?.(actionKey, entity, payload);
    },
    [onQuickAction, entity],
  );

  const statusBadge = useMemo(() => {
    if (!getStatusKey) return null;
    const status = getStatusKey(entity);
    if (!status) return null;
    const config = statusConfig?.[status];
    return { status, config };
  }, [entity, getStatusKey, statusConfig]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Suppress container keyboard actions when focus is within child interactive controls
      if (e.target !== e.currentTarget) {
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        handleSelect();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleView();
      }
    },
    [handleSelect, handleView],
  );

  const isFocusable = canSelect || Boolean(onView || onEdit);

  const cardProps = useMemo(
    () => ({
      tabIndex: isFocusable ? 0 : undefined,
      role: "article" as const,
      onKeyDown: handleKeyDown,
      // `aria-selected` is invalid on role="article" (axe aria-allowed-attr).
      // Selection state is exposed on the card checkbox; sync visual via data attr.
      "data-selected": canSelect ? isSelected : undefined,
    }),
    [isFocusable, handleKeyDown, canSelect, isSelected],
  );

  return {
    isSelected,
    onSelect: handleSelect,
    onSelectOnly: handleSelectOnly,
    onView: handleView,
    onEdit: handleEdit,
    executeQuickAction,
    statusBadge,
    onKeyDown: handleKeyDown,
    cardProps,
  };
}

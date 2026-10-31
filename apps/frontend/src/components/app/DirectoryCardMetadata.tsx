import React from "react";
import type { ReactNode } from "react";
import { DirectoryCardMetaTile } from "@/components/app/DirectoryCardMetaTile";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { getEntityDescriptor } from "@/components/common/entityRegistry";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { EntityCard } from "@/components/app/EntityCard";

/** Resolve a descriptor field label — labelKey via i18n wins over the legacy hardcoded label. Falls back to field.label if unmapped or raw key returned. */
export function resolveFieldLabel(
  field: { label: string; labelKey?: string },
  t: TranslationFunction | ((key: string) => string),
): string {
  if (!field.labelKey) return field.label;
  const translated = (t as (k: string) => string)(field.labelKey);
  return translated && translated !== field.labelKey ? translated : field.label;
}

export interface EntityCardMetadataExtraColumns<TColumn extends { label: string }> {
  columns: TColumn[];
  keyFor: (col: TColumn) => string;
  labelFor: (col: TColumn) => string;
  renderValue: (col: TColumn) => ReactNode | null;
}

export interface EntityCardMetadataProps<
  TColumn extends { label: string } = { label: string },
  TEntity = unknown,
> {
  columns?: TColumn[];
  /** Stable tile key per column. */
  keyFor?: (col: TColumn) => string;
  /** Localized tile label per column. */
  labelFor?: (col: TColumn) => string;
  /** Tile value per column — return null to drop the tile (empty values). */
  renderValue?: (col: TColumn) => ReactNode | null;
  /** Entity domain type name to look up in declarative SSOT registry (e.g. 'contacts', 'students') */
  entityType?: string;
  /** Declarative SSOT entity descriptor (falls back to entityType lookup if omitted) */
  descriptor?: EntityDescriptor<TEntity>;
  /** Entity instance to render when descriptor or entityType is provided */
  entity?: TEntity;
  /** Optional filter to only show tiles for columns enabled in user's layout */
  visibleColumnIds?: string[];
  /** Optional predicate to filter visible columns/fields */
  isColumnVisible?: (key: string) => boolean;
  /** Optional legacy extra columns to merge with descriptor-driven tiles (deduped by key). */
  extraColumns?: EntityCardMetadataExtraColumns<TColumn>;
}

/**
 * Shared Work-directory card metadata grid.
 *
 * Supports both declarative {@link EntityDescriptor} rendering and legacy column lists.
 * Maps attributes to {@link DirectoryCardMetaTile}s inside a {@link EntityCard.MetaGrid}.
 */
export const DirectoryCardMetadata = React.memo(function DirectoryCardMetadata<
  TColumn extends { label: string } = { label: string },
  TEntity = unknown,
>({
  columns,
  keyFor,
  labelFor,
  renderValue,
  entityType,
  descriptor,
  entity,
  visibleColumnIds,
  isColumnVisible,
  extraColumns,
}: EntityCardMetadataProps<TColumn, TEntity>): React.JSX.Element | null {
  const { t } = useTranslation();
  const effectiveDescriptor =
    descriptor ??
    (entityType
      ? (getEntityDescriptor(entityType) as EntityDescriptor<TEntity> | undefined)
      : undefined);

  if (effectiveDescriptor && entity) {
    const cardFields = effectiveDescriptor.getCardFields().filter((field) => {
      if (isColumnVisible && !isColumnVisible(field.key)) return false;
      if (!visibleColumnIds || visibleColumnIds.length === 0) return true;
      return visibleColumnIds.includes(field.key);
    });

    const tiles: React.JSX.Element[] = [];
    for (const field of cardFields) {
      const value = effectiveDescriptor.renderFieldValue(field.key, entity);
      if (value !== null && value !== undefined) {
        tiles.push(
          <DirectoryCardMetaTile key={field.key} label={resolveFieldLabel(field, t)}>
            {value}
          </DirectoryCardMetaTile>,
        );
      }
    }

    if (extraColumns) {
      const renderedKeys = new Set(cardFields.map((field) => field.key));
      for (const col of extraColumns.columns) {
        const colKey = extraColumns.keyFor(col);
        if (renderedKeys.has(colKey)) continue;
        if (isColumnVisible && !isColumnVisible(colKey)) continue;
        const value = extraColumns.renderValue(col);
        if (value === null || value === undefined) continue;
        renderedKeys.add(colKey);
        tiles.push(
          <DirectoryCardMetaTile key={colKey} label={extraColumns.labelFor(col)}>
            {value}
          </DirectoryCardMetaTile>,
        );
      }
    }

    if (tiles.length === 0) return null;

    return <EntityCard.MetaGrid>{tiles}</EntityCard.MetaGrid>;
  }

  if (!columns || !keyFor || !labelFor || !renderValue) {
    return null;
  }

  const tiles = columns.map((col) => {
    const value = renderValue(col);
    if (value === null || value === undefined) return null;
    return (
      <DirectoryCardMetaTile key={keyFor(col)} label={labelFor(col)}>
        {value}
      </DirectoryCardMetaTile>
    );
  });

  const hasTiles = tiles.some((tile) => tile !== null);
  if (!hasTiles) return null;

  return <EntityCard.MetaGrid>{tiles}</EntityCard.MetaGrid>;
}) as <TColumn extends { label: string } = { label: string }, TEntity = unknown>(
  props: EntityCardMetadataProps<TColumn, TEntity>,
) => React.JSX.Element | null;

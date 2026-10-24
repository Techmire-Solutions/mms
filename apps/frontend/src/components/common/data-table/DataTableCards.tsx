import React from "react";
import { EntityCard } from "@/components/app/EntityCard";
import { EntityCardsGrid } from "@/components/app/EntityCardsGrid";
import { EntityCardMetaTile } from "@/components/app/EntityCardMetaTile";
import type { DataTableCardContext, DataTableCardSlots, DataTableColumn } from "./dataTableTypes";

/** EntityCard tile (DataTable default) — not DirectoryCard. */
export interface DataTableCardsProps<TData extends { id: string | number }> {
  rows: readonly TData[];
  columns: readonly DataTableColumn<TData>[];
  card?: DataTableCardSlots<TData>;
  renderCard?: (row: TData, index: number, ctx: DataTableCardContext) => React.ReactNode;
  isColumnVisible: (columnId: string) => boolean;
  renderRowActions?: (row: TData, index: number) => React.ReactNode;
  onRowClick?: (row: TData) => void;
}

/** Card view for {@link DataTable}: title + visible columns as meta tiles + row actions. */
export function DataTableCards<TData extends { id: string | number }>({
  rows,
  columns,
  card,
  renderCard,
  isColumnVisible,
  renderRowActions,
  onRowClick,
}: DataTableCardsProps<TData>): React.JSX.Element {
  const [titleColumn, ...restColumns] = columns;
  const metaColumns = (card?.title ? columns : restColumns).filter((column) => !column.hideInCard);

  const indexById = new Map(rows.map((row, index) => [row.id, index]));

  const renderOne = (row: TData): React.ReactNode => {
    const index = indexById.get(row.id) ?? 0;
    if (renderCard)
      return (
        <React.Fragment key={String(row.id)}>
          {renderCard(row, index, { isColumnVisible })}
        </React.Fragment>
      );
    return (
      <EntityCard
        key={String(row.id)}
        accentClassName={false}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
        tabIndex={onRowClick ? 0 : undefined}
        role={onRowClick ? "button" : undefined}
        onKeyDown={
          onRowClick
            ? (e: React.KeyboardEvent) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick(row);
                }
              }
            : undefined
        }
        className={
          onRowClick
            ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1 text-sm font-semibold text-foreground text-pretty break-words">
            {card?.title ? card.title(row) : titleColumn?.render(row, index)}
          </div>
          {card?.badge ? <div className="shrink-0">{card.badge(row)}</div> : null}
        </div>
        {metaColumns.length > 0 ? (
          <EntityCard.MetaGrid>
            {metaColumns.map((column) => (
              <EntityCardMetaTile key={column.id} label={column.label}>
                {column.render(row, index)}
              </EntityCardMetaTile>
            ))}
          </EntityCard.MetaGrid>
        ) : null}
        {renderRowActions ? (
          <div
            className="flex justify-end gap-1 border-t border-border/40 pt-2"
            onClick={(event) => event.stopPropagation()}
          >
            {renderRowActions(row, index)}
          </div>
        ) : null}
      </EntityCard>
    );
  };

  /** `items` mode lets the grid virtualize past 30 cards (rows of two). */
  return <EntityCardsGrid cols={2} items={rows} renderItem={renderOne} />;
}

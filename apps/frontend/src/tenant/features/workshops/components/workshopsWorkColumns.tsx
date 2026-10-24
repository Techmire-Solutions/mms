/**
 * @file workshopsWorkColumns.tsx
 * @description WorkBatchTable column definitions for the Workshops Work directory.
 */

import { formatDate, type AppTranslationKey, type WorkshopEvent } from "@mms/shared";
import type { WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import { TableCellLink } from "@shared/ui";
import { WORKSHOP_TITLE_DEFAULT_WIDTH } from "../hooks/useWorkshopsColumnLayout";

type Translate = (key: AppTranslationKey, params?: Record<string, string | number>) => string;

/** "1 Mar – 2 Mar", a single day, or "—" when the workshop has no dates yet. */
export function formatWorkshopDates(workshop: WorkshopEvent): string {
  if (!workshop.startDate) return "—";
  const start = formatDate(workshop.startDate);
  if (!workshop.endDate || workshop.endDate === workshop.startDate) return start;
  return `${start} – ${formatDate(workshop.endDate)}`;
}

/** "12 / 20" with a capacity, otherwise just the registered count. */
export function formatWorkshopFill(t: Translate, workshop: WorkshopEvent): string {
  return workshop.capacity
    ? t("workshops.capacityOf", { count: workshop.participantCount, capacity: workshop.capacity })
    : t("workshops.participantCount", { count: workshop.participantCount });
}

export function buildWorkshopsWorkColumns(
  t: Translate,
  formatCurrency: (value: number) => string,
  onView: (workshop: WorkshopEvent) => void,
  options: {
    isColumnVisible?: (key: string) => boolean;
    getColumnWidth?: (key: string) => number | undefined;
  } = {},
): WorkBatchTableColumn<WorkshopEvent>[] {
  const isVisible = options.isColumnVisible ?? (() => true);
  const widthOf = options.getColumnWidth;
  const dash = <span className="text-muted-foreground/60 text-xs">—</span>;

  const columns: WorkBatchTableColumn<WorkshopEvent>[] = [
    {
      id: "title",
      label: t("workshops.title"),
      width: widthOf?.("title") ?? WORKSHOP_TITLE_DEFAULT_WIDTH,
      render: (workshop) => (
        <TableCellLink tap className="text-start font-medium" onClick={() => onView(workshop)}>
          {workshop.title}
        </TableCellLink>
      ),
    },
    {
      id: "dates",
      label: t("workshops.dates"),
      width: widthOf?.("dates") ?? 200,
      noWrap: true,
      render: (workshop) => <span className="text-sm">{formatWorkshopDates(workshop)}</span>,
    },
    {
      id: "registrationDeadline",
      label: t("workshops.registrationDeadline"),
      width: widthOf?.("registrationDeadline") ?? 150,
      noWrap: true,
      render: (workshop) =>
        workshop.registrationDeadline ? (
          <span className="text-sm">{formatDate(workshop.registrationDeadline)}</span>
        ) : (
          dash
        ),
    },
    {
      id: "participants",
      label: t("workshops.participants"),
      width: widthOf?.("participants") ?? 140,
      noWrap: true,
      render: (workshop) => (
        <span className="text-sm tabular-nums">{formatWorkshopFill(t, workshop)}</span>
      ),
    },
    {
      id: "fee",
      label: t("workshops.fee"),
      width: widthOf?.("fee") ?? 110,
      noWrap: true,
      render: (workshop) =>
        workshop.fee ? (
          <span className="text-sm tabular-nums">{formatCurrency(workshop.fee)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t("workshops.free")}</span>
        ),
    },
  ];

  return columns.filter((column) => column.id === "title" || isVisible(column.id));
}

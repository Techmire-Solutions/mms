/**
 * @file TasksPaginationFooter.tsx
 * @description Server-page footer for the Tasks Work directory.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface TasksPaginationFooterProps {
  total: number;
  pageIndex: number;
  pageSize: number;
  onPageChange: (pageIndex: number) => void;
}

export function TasksPaginationFooter({
  total,
  pageIndex,
  pageSize,
  onPageChange,
}: TasksPaginationFooterProps): React.JSX.Element {
  const { t } = useTranslation();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
      <span>{t("tasks.shownCount", { count: total })}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="capsOutline"
          size="caps"
          disabled={pageIndex === 0}
          onClick={() => onPageChange(pageIndex - 1)}
        >
          {t("common.previous")}
        </Button>
        <span>
          {pageIndex + 1} / {pageCount}
        </span>
        <Button
          variant="capsOutline"
          size="caps"
          disabled={pageIndex + 1 >= pageCount}
          onClick={() => onPageChange(pageIndex + 1)}
        >
          {t("common.next")}
        </Button>
      </div>
    </div>
  );
}

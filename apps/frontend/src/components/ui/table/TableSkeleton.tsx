import React from "react";
import {
  TableSkeleton as SharedTableSkeleton,
  type TableSkeletonProps as SharedTableSkeletonProps,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";

export type TableSkeletonProps = SharedTableSkeletonProps;

/**
 * Localized TableSkeleton facade delegating to `@shared/ui`.
 */
export function TableSkeleton({ loadingLabel, ...props }: TableSkeletonProps): React.JSX.Element {
  const { t } = useTranslation();
  return <SharedTableSkeleton loadingLabel={loadingLabel || t("common.loading")} {...props} />;
}

import React from "react";
import {
  ListPagination as SharedListPagination,
  type ListPaginationProps as SharedListPaginationProps,
  type ListPaginationLabels,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import type { AppTranslationKey } from "@mms/shared";

export interface ListPaginationProps extends Omit<SharedListPaginationProps, "labels"> {
  i18nNamespace?: string;
  labels?: ListPaginationLabels;
}

/**
 * Tenant facade for ListPagination with TanStack/i18next localization defaults.
 * Delegates layout, pagination math, accessibility, and UI rendering to `@shared/ui`.
 */
export function ListPagination({
  i18nNamespace = "common",
  variant = "range",
  labels,
  ...props
}: ListPaginationProps): React.JSX.Element | null {
  const { t } = useTranslation();

  const prevKey = `${i18nNamespace}.pagination.previous` as AppTranslationKey;
  const nextKey = `${i18nNamespace}.pagination.next` as AppTranslationKey;
  const summaryKey = `${i18nNamespace}.pagination.summary` as AppTranslationKey;
  const rangeKey = `${i18nNamespace}.pagination.range` as AppTranslationKey;
  const pageOfKey = `${i18nNamespace}.pagination.pageOf` as AppTranslationKey;
  const labelKey = `${i18nNamespace}.pagination.label` as AppTranslationKey;

  const previousLabel =
    variant === "compact"
      ? (t("pagination.previousAria" as AppTranslationKey) ?? "Previous")
      : (t(prevKey) ?? "Previous");

  const nextLabel =
    variant === "compact"
      ? (t("pagination.nextAria" as AppTranslationKey) ?? "Next")
      : (t(nextKey) ?? "Next");

  const navLabel =
    variant === "summary"
      ? i18nNamespace === "enrollments"
        ? t(labelKey)
        : undefined
      : (t(labelKey) ?? "Pagination");

  const resolvedLabels: ListPaginationLabels = {
    previous: previousLabel,
    next: nextLabel,
    range: (from, to, total) =>
      t(rangeKey, { from, to, total }) ?? `Showing ${from} to ${to} of ${total}`,
    pageOf: (page, totalPages) =>
      t(pageOfKey, { page, totalPages }) ?? `Page ${page} of ${totalPages}`,
    summary: (count, page, totalPages) =>
      t(summaryKey, { count, page, totalPages }) ??
      `${count} items · Page ${page} of ${totalPages}`,
    label: navLabel,
    ...labels,
  };

  return <SharedListPagination variant={variant} labels={resolvedLabels} {...props} />;
}

ListPagination.displayName = "ListPagination";

export type { ListPaginationLabels };

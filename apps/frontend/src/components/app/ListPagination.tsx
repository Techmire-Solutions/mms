import React from "react";
import {
  ListPagination as SharedListPagination,
  type ListPaginationProps as SharedListPaginationProps,
  type ListPaginationLabels,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { formatNumber, type AppTranslationKey } from "@mms/shared";

export interface ListPaginationProps extends Omit<SharedListPaginationProps, "labels"> {
  i18nNamespace?: string;
  labels?: ListPaginationLabels;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * Tenant facade for ListPagination with TanStack/i18next localization defaults.
 *
 * `t()` returns the key itself when a translation is missing, so `?? "English"`
 * fallbacks never fired. Resolution is an explicit chain instead: the module
 * namespace key, then the shared `common.pagination.*` key, then English.
 */
export function ListPagination({
  i18nNamespace = "common",
  variant = "range",
  labels,
  ...props
}: ListPaginationProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const translate = t as unknown as Translate;

  const namespaceKey = (suffix: string): AppTranslationKey =>
    `${i18nNamespace}.pagination.${suffix}` as AppTranslationKey;

  const resolve = (
    key: AppTranslationKey,
    fallbackKey: AppTranslationKey | undefined,
    english: string,
    params?: Record<string, string | number>,
  ): string => {
    const value = translate(key, params);
    if (value !== key) return value;
    if (fallbackKey) {
      const fallbackValue = translate(fallbackKey, params);
      if (fallbackValue !== fallbackKey) return fallbackValue;
    }
    return english;
  };

  const previousLabel =
    variant === "compact"
      ? resolve(
          "pagination.previousAria" as AppTranslationKey,
          "common.previous" as AppTranslationKey,
          "Previous",
        )
      : resolve(namespaceKey("previous"), "common.previous" as AppTranslationKey, "Previous");

  const nextLabel =
    variant === "compact"
      ? resolve(
          "pagination.nextAria" as AppTranslationKey,
          "common.next" as AppTranslationKey,
          "Next",
        )
      : resolve(namespaceKey("next"), "common.next" as AppTranslationKey, "Next");

  const navLabel =
    variant === "summary" && i18nNamespace !== "enrollments"
      ? undefined
      : resolve(
          namespaceKey("label"),
          "common.pagination.label" as AppTranslationKey,
          "Pagination",
        );

  const resolvedLabels: ListPaginationLabels = {
    previous: previousLabel,
    next: nextLabel,
    range: (from, to, total) =>
      resolve(
        namespaceKey("range"),
        "common.pagination.range" as AppTranslationKey,
        `Showing ${from} to ${to} of ${total}`,
        { from: formatNumber(from), to: formatNumber(to), total: formatNumber(total) },
      ),
    pageOf: (page, totalPages) =>
      resolve(
        namespaceKey("pageOf"),
        "common.pagination.pageOf" as AppTranslationKey,
        `Page ${page} of ${totalPages}`,
        { page: formatNumber(page), totalPages: formatNumber(totalPages) },
      ),
    summary: (count, page, totalPages) =>
      resolve(
        namespaceKey("summary"),
        "common.pagination.summary" as AppTranslationKey,
        `${count} items · Page ${page} of ${totalPages}`,
        {
          count: formatNumber(count),
          page: formatNumber(page),
          totalPages: formatNumber(totalPages),
        },
      ),
    label: navLabel,
    ...labels,
  };

  return (
    <SharedListPagination
      variant={variant}
      labels={resolvedLabels}
      formatPageNumber={formatNumber}
      {...props}
    />
  );
}

ListPagination.displayName = "ListPagination";

export type { ListPaginationLabels };

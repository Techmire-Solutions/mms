import React from "react";
import { SearchBar as SharedSearchBar, type SearchBarProps as SharedSearchBarProps } from "@mms/ui";
import { useTranslation } from "../i18n/index.js";

export type SearchBarProps = SharedSearchBarProps;

/**
 * SearchBar facade — adapts @mms/ui SearchBar with localized
 * placeholder and clear-search button labels from useTranslation().
 */
export function SearchBar({
  placeholder,
  clearLabel,
  ariaLabel,
  ...props
}: SearchBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("common.searchPlaceholder");
  const resolvedClearLabel = clearLabel ?? t("common.clearSearch");
  const resolvedAriaLabel = ariaLabel ?? placeholder ?? t("common.searchPlaceholder");

  return (
    <SharedSearchBar
      placeholder={resolvedPlaceholder}
      clearLabel={resolvedClearLabel}
      ariaLabel={resolvedAriaLabel}
      {...props}
    />
  );
}

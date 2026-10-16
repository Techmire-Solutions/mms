import React from "react";
import {
  SearchBar as SharedSearchBar,
  type SearchBarProps as SharedSearchBarProps,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";

export type SearchBarProps = SharedSearchBarProps;

/**
 * SearchBar facade — adapts @shared/ui SearchBar with localized
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

import React from "react";
import {
  FormSelectSearchContent as SharedFormSelectSearchContent,
  type FormSelectSearchContentProps as SharedFormSelectSearchContentProps,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";

export type FormSelectSearchContentProps = SharedFormSelectSearchContentProps;

/**
 * Search box + filtered listbox facade rendered inside the FormSelect popover.
 * Injects localized search and empty-state copy via useTranslation().
 */
export function FormSelectSearchContent({
  searchLabel,
  searchPlaceholder,
  noMatchingOptionsLabel,
  ...props
}: FormSelectSearchContentProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SharedFormSelectSearchContent
      searchLabel={searchLabel ?? t("common.search")}
      searchPlaceholder={searchPlaceholder ?? t("common.searchPlaceholder")}
      noMatchingOptionsLabel={noMatchingOptionsLabel ?? t("common.noMatchingOptions")}
      {...props}
    />
  );
}

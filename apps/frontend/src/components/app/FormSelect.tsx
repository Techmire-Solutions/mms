import React from "react";
import {
  FormSelect as SharedFormSelect,
  type FormSelectProps as SharedFormSelectProps,
  type FormSelectOption,
  type FormSelectSearchLabels,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";

export type { FormSelectOption, FormSelectSearchLabels };
export type FormSelectProps = SharedFormSelectProps;

/**
 * FormSelect facade — wraps @shared/ui FormSelect with localized
 * search and empty-state defaults from useTranslation().
 */
export function FormSelect({ searchLabels, ...props }: FormSelectProps): React.JSX.Element {
  const { t } = useTranslation();

  const resolvedSearchLabels: FormSelectSearchLabels = {
    search: searchLabels?.search ?? t("common.search"),
    searchPlaceholder: searchLabels?.searchPlaceholder ?? t("common.searchPlaceholder"),
    noMatchingOptions: searchLabels?.noMatchingOptions ?? t("common.noMatchingOptions"),
  };

  return <SharedFormSelect searchLabels={resolvedSearchLabels} {...props} />;
}

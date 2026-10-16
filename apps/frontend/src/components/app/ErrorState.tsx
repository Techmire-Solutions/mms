import React from "react";
import {
  ErrorState as SharedErrorState,
  type ErrorStateProps as SharedErrorStateProps,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import type { AppTranslationKey } from "@mms/shared";

export type ErrorStateProps = SharedErrorStateProps;

const TITLE_KEYS: Record<NonNullable<SharedErrorStateProps["type"]>, AppTranslationKey> = {
  generic: "errors.state.generic",
  network: "errors.state.network",
  permission: "errors.state.permission",
};

/**
 * Localized ErrorState facade delegating to `@shared/ui`.
 * Auto-injects tenant translations when title or retry label are omitted.
 */
export function ErrorState({
  title,
  type = "generic",
  retryLabel,
  ...props
}: ErrorStateProps): React.JSX.Element {
  const { t } = useTranslation();
  const defaultTitle = t(TITLE_KEYS[type] || TITLE_KEYS.generic);
  const defaultRetryLabel = retryLabel || t("common.tryAgain");

  return (
    <SharedErrorState
      title={title || defaultTitle}
      type={type}
      retryLabel={defaultRetryLabel}
      {...props}
    />
  );
}

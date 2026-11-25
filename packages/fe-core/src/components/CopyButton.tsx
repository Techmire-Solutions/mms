import React from "react";
import {
  CopyButton as SharedCopyButton,
  type CopyButtonProps as SharedCopyButtonProps,
} from "@mms/ui";
import { useTranslation } from "../i18n/index.js";
import { notify } from "../notify.js";

export interface CopyButtonProps extends SharedCopyButtonProps {
  showToast?: boolean;
}

export type CopyBtnProps = CopyButtonProps;

/**
 * Reusable copy-to-clipboard control facade with feedback icon + optional toast.
 * Re-exports and adapts @mms/ui CopyButton with localization and toast notification defaults.
 */
export function CopyButton({
  showToast = false,
  onCopy,
  title,
  titleCopied,
  label,
  labelCopied,
  ...rest
}: CopyButtonProps): React.JSX.Element {
  const { t } = useTranslation();

  const handleCopy = () => {
    if (showToast) {
      notify.success(t("common.copied"));
    }
    onCopy?.();
  };

  return (
    <SharedCopyButton
      title={title ?? t("common.copy")}
      titleCopied={titleCopied ?? t("common.copied")}
      label={label}
      labelCopied={labelCopied ?? (label ? t("common.copied") : undefined)}
      onCopy={handleCopy}
      {...rest}
    />
  );
}

export const CopyBtn = CopyButton;

import React from "react";
import {
  CopyButton as SharedCopyButton,
  type CopyButtonProps as SharedCopyButtonProps,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

export interface CopyButtonProps extends SharedCopyButtonProps {
  showToast?: boolean;
}

export type CopyBtnProps = CopyButtonProps;

/**
 * Reusable copy-to-clipboard control facade with feedback icon + optional toast.
 * Re-exports and adapts @shared/ui CopyButton with localization and toast notification defaults.
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

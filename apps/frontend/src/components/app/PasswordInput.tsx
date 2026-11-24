import React from "react";
import {
  PasswordInput as SharedPasswordInput,
  type PasswordInputProps as SharedPasswordInputProps,
} from "@mms/ui";
import { useTranslation } from "@/hooks/useTranslation";

export type PasswordInputProps = SharedPasswordInputProps;

/**
 * Localized PasswordInput facade delegating to `@mms/ui`.
 * Auto-injects tenant translations for show/hide password buttons.
 */
export const PasswordInput: React.FC<PasswordInputProps> = ({
  showPasswordLabel,
  hidePasswordLabel,
  ...props
}) => {
  const { t } = useTranslation();
  return (
    <SharedPasswordInput
      showPasswordLabel={showPasswordLabel || t("auth.showPassword")}
      hidePasswordLabel={hidePasswordLabel || t("auth.hidePassword")}
      {...props}
    />
  );
};

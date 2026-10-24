import React from "react";
import {
  OtpInput as SharedOtpInput,
  createEmptyOtp,
  isOtpComplete,
  FORM_OTP_DIGIT,
  type OtpInputProps as SharedOtpInputProps,
} from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";

export type OtpInputProps = SharedOtpInputProps;
export { createEmptyOtp, isOtpComplete, FORM_OTP_DIGIT };

/**
 * Localized OtpInput facade delegating to `@shared/ui`.
 * Auto-injects RTL direction and localized digit labels.
 */
export function OtpInput({
  digitLabel,
  isRtl: propIsRtl,
  ...props
}: OtpInputProps): React.JSX.Element {
  const { t, isRtl: hookIsRtl } = useTranslation();
  const isRtl = propIsRtl ?? hookIsRtl;
  const defaultDigitLabel = (current: number, total: number) =>
    t("auth.otpDigitLabel", { current, total });

  return <SharedOtpInput isRtl={isRtl} digitLabel={digitLabel || defaultDigitLabel} {...props} />;
}

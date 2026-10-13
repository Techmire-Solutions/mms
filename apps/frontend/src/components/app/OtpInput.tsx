import React, { useRef } from "react";
import { FORM_OTP_DIGIT } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

interface OtpInputProps {
  value: string[];
  onChange: (updatedValue: string[]) => void;
  ariaLabel: string;
  disabled?: boolean;
  hasError?: boolean;
  length?: number;
  idPrefix?: string;
}

/**
 * Shared OTP Input component used for 2FA, platform registration, and password reset.
 */
export function OtpInput({
  value,
  onChange,
  ariaLabel,
  disabled = false,
  hasError = false,
  length = 6,
  idPrefix = "otp",
}: OtpInputProps): React.JSX.Element {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const { t, isRtl } = useTranslation();

  const focusIndex = (index: number): void => {
    inputs.current[index]?.focus();
  };

  const handleChange = (index: number, digit: string): void => {
    if (!/^\d?$/.test(digit)) return;
    const updatedValue = [...value];
    updatedValue[index] = digit;
    onChange(updatedValue);
    if (digit && index < length - 1) {
      focusIndex(index + 1);
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Backspace" && !value[index] && index > 0) {
      focusIndex(index - 1);
      return;
    }

    const goPrevious = isRtl ? event.key === "ArrowRight" : event.key === "ArrowLeft";
    const goNext = isRtl ? event.key === "ArrowLeft" : event.key === "ArrowRight";

    if (goPrevious && index > 0) {
      event.preventDefault();
      focusIndex(index - 1);
    }
    if (goNext && index < length - 1) {
      event.preventDefault();
      focusIndex(index + 1);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>): void => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    const updatedCode = [...value];
    for (let i = 0; i < length; i++) {
      if (i < pasted.length) {
        updatedCode[i] = pasted[i];
      }
    }
    onChange(updatedCode);
    focusIndex(Math.min(pasted.length, length - 1));
  };

  return (
    <div
      className="flex justify-center gap-2 sm:gap-2.5"
      role="group"
      aria-label={ariaLabel}
      aria-invalid={hasError || undefined}
    >
      {Array.from({ length }).map((_, index) => {
        const digit = value[index] || "";
        return (
          <input
            key={index}
            id={`${idPrefix}-${index}`}
            name={index === 0 ? "one-time-code" : `${idPrefix}-${index}`}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            className={cn(
              FORM_OTP_DIGIT,
              digit ? "border-primary/60 bg-primary/5" : "border-border",
              hasError && "border-destructive/60 bg-destructive/5",
            )}
            aria-label={t("auth.otpDigitLabel", { current: index + 1, total: length })}
            aria-invalid={hasError || undefined}
            autoFocus={index === 0}
          />
        );
      })}
    </div>
  );
}

export function createEmptyOtp(length = 6): string[] {
  return Array(length).fill("");
}

export function isOtpComplete(value: string[], length = 6): boolean {
  return value.join("").length === length;
}

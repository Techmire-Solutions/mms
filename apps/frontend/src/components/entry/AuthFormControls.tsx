import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AuthBackLink({
  to,
  onClick,
  disabled,
  label,
}: {
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  label: string;
}): React.JSX.Element {
  const commonClasses =
    "inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 font-medium text-primary transition-colors hover:text-primary/80 hover:underline disabled:pointer-events-none disabled:opacity-50";

  const content = (
    <>
      <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
      {label}
    </>
  );

  return (
    <p className="text-center text-xs text-muted-foreground">
      {to ? (
        <Button variant="link" asChild className={commonClasses}>
          <Link to={to}>{content}</Link>
        </Button>
      ) : (
        <Button
          type="button"
          variant="link"
          onClick={onClick}
          disabled={disabled}
          className={commonClasses}
        >
          {content}
        </Button>
      )}
    </p>
  );
}

export function AuthSubmitButton({
  busy,
  busyLabel,
  label,
  disabled,
  icon: Icon,
  showArrow = true,
}: {
  busy: boolean;
  busyLabel: string;
  label: string;
  disabled?: boolean;
  icon?: LucideIcon;
  showArrow?: boolean;
}): React.JSX.Element {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={busy || disabled}
      className="h-11 w-full rounded-xl font-semibold shadow-md shadow-primary/10 transition-shadow hover:shadow-lg hover:shadow-primary/15"
    >
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {busyLabel}
        </>
      ) : (
        <>
          {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
          {label}
          {showArrow ? <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden /> : null}
        </>
      )}
    </Button>
  );
}

/** Shared OTP resend control — countdown text or resend button. */
export function AuthResendCodeControl({
  countdown,
  onResend,
  disabled,
  countdownLabel,
  resendLabel,
}: {
  countdown: number;
  onResend: () => void;
  disabled?: boolean;
  countdownLabel: string;
  resendLabel: string;
}): React.JSX.Element {
  if (countdown > 0) {
    return (
      <p className="text-center text-xs text-muted-foreground" role="status">
        {countdownLabel}
      </p>
    );
  }

  return (
    <div className="text-center">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onResend}
        disabled={disabled}
        className="min-h-11 gap-1.5 text-xs font-medium text-primary"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        {resendLabel}
      </Button>
    </div>
  );
}

import React from "react";
import { cn } from "../utils";

export interface PasswordStrengthCheck {
  label: string;
  pass: boolean;
}

export interface PasswordStrengthMeterProps {
  /** Optional raw password string. If score is not provided, score is estimated from this. */
  password?: string;
  /** Explicit score between 0 and 5. */
  score?: number;
  /** Active bar fill class (e.g. "bg-success", "bg-warning", "bg-destructive"). */
  colorClass?: string;
  /** Text description of strength (e.g. "Strong", "Weak"). */
  strengthLabel?: string;
  /** Header label for the meter (default: "Password strength"). */
  strengthTitle?: string;
  /** Criteria checklist items. */
  checks?: PasswordStrengthCheck[];
  /** Whether to render the criteria checklist below the meter. */
  showChecks?: boolean;
  className?: string;
}

function resolveScoreAndColor(
  password?: string,
  explicitScore?: number,
  explicitColor?: string,
): { score: number; colorClass: string } {
  if (explicitScore !== undefined) {
    const score = Math.max(0, Math.min(5, explicitScore));
    const color =
      explicitColor ??
      (score <= 1
        ? "bg-destructive"
        : score === 2
          ? "bg-destructive/80"
          : score === 3
            ? "bg-warning"
            : score === 4
              ? "bg-success/80"
              : "bg-success");
    return { score, colorClass: color };
  }

  if (!password) {
    return { score: 0, colorClass: "bg-muted" };
  }

  let s = 0;
  if (password.length >= 8) s += 1;
  if (password.length >= 12) s += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s += 1;
  if (/[0-9]/.test(password)) s += 1;
  if (/[^A-Za-z0-9]/.test(password)) s += 1;

  const color =
    s <= 1
      ? "bg-destructive"
      : s === 2
        ? "bg-destructive/80"
        : s === 3
          ? "bg-warning"
          : s === 4
            ? "bg-success/80"
            : "bg-success";

  return { score: s, colorClass: explicitColor ?? color };
}

export function PasswordStrengthMeter({
  password,
  score: explicitScore,
  colorClass: explicitColor,
  strengthLabel,
  strengthTitle = "Password strength",
  checks: explicitChecks,
  showChecks = false,
  className,
}: PasswordStrengthMeterProps): React.JSX.Element | null {
  if (password === "" && explicitScore === undefined) return null;
  if (password === undefined && explicitScore === undefined) return null;

  const { score, colorClass } = resolveScoreAndColor(password, explicitScore, explicitColor);

  const checks =
    explicitChecks ??
    (password !== undefined
      ? [
          { label: "At least 8 characters", pass: password.length >= 8 },
          { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
          { label: "Number", pass: /[0-9]/.test(password) },
          { label: "Special symbol", pass: /[^A-Za-z0-9]/.test(password) },
        ]
      : []);

  const defaultStrengthLabel =
    strengthLabel ??
    (score <= 1
      ? "Very Weak"
      : score === 2
        ? "Weak"
        : score === 3
          ? "Medium"
          : score === 4
            ? "Strong"
            : "Very Strong");

  return (
    <div className={cn("space-y-2 pt-1", className)} aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground font-medium">{strengthTitle}</span>
        <span className="font-semibold text-xs capitalize">{defaultStrengthLabel}</span>
      </div>

      <div
        className="grid grid-cols-5 gap-1.5 h-1.5 rounded-full overflow-hidden bg-muted"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={5}
        aria-label={strengthTitle}
        aria-valuetext={defaultStrengthLabel}
      >
        {[1, 2, 3, 4, 5].map((step) => (
          <div
            key={step}
            className={cn(
              "h-full transition-colors duration-300 motion-reduce:transition-none",
              score >= step ? colorClass : "bg-transparent",
            )}
          />
        ))}
      </div>

      {showChecks && checks.length > 0 ? (
        <div className="grid grid-cols-2 gap-1 pt-1">
          {checks.map((item) => (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-1.5 text-3xs transition-colors",
                item.pass ? "text-success font-semibold" : "text-muted-foreground",
              )}
            >
              <span>{item.pass ? "✓" : "○"}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

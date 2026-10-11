import React from 'react';

/** Primary + accent swatches with hex values for theme summary rows. */
export function SettingsColoursBadge({
  primaryColor,
  secondaryColor,
  ariaLabel,
}: {
  primaryColor: string;
  secondaryColor: string;
  ariaLabel: string;
}): React.JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
      aria-label={ariaLabel}
    >
      <span
        className="h-3 w-3 shrink-0 rounded-full border border-border"
        style={{ backgroundColor: primaryColor }}
        aria-hidden
      />
      <span>{primaryColor}</span>
      <span aria-hidden>·</span>
      <span
        className="h-3 w-3 shrink-0 rounded-full border border-border"
        style={{ backgroundColor: secondaryColor }}
        aria-hidden
      />
      <span>{secondaryColor}</span>
    </span>
  );
}

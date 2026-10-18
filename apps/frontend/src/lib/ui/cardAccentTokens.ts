import { resolveAccentTone, withAccentAliases, type AccentName } from "./accentTone";

/** SSOT for card and section start-edge accent stripe geometry */
export const CARD_STRIPE_WIDTH = "w-1.5";
export const CARD_STRIPE_INSET = "ps-5 sm:ps-6";
export const CARD_STRIPE_BASE = "absolute inset-y-0 start-0 w-1.5";

/** Card start-edge accent stripe colors (theme tokens). */
export const CARD_STRIPE_COLORS = withAccentAliases({
  primary: "bg-primary/45 group-hover/card:bg-primary",
  success: "bg-success/45 group-hover/card:bg-success",
  warning: "bg-warning/45 group-hover/card:bg-warning",
  destructive: "bg-destructive/45 group-hover/card:bg-destructive",
  info: "bg-info/45 group-hover/card:bg-info",
  secondary: "bg-secondary/45 group-hover/card:bg-secondary",
  muted: "bg-muted-foreground/35 group-hover/card:bg-muted-foreground",
});

export type CardAccentColor = AccentName;

/** Returns the matching CSS class for a card accent stripe with safe primary fallback. */
export function getCardStripeClass(accent?: CardAccentColor | string): string {
  if (!accent) return "";
  return CARD_STRIPE_COLORS[resolveAccentTone(accent)];
}

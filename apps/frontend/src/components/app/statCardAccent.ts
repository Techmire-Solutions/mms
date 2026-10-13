import { resolveAccentTone, withAccentAliases } from "@/lib/accentTone";
import {
  type CardAccentColor,
  getCardStripeClass,
  SEMANTIC_BG,
  SEMANTIC_TEXT,
} from "@/lib/semanticTone";

export interface AccentConfig {
  stripe: string;
  iconBg: string;
  iconText: string;
  ring: string;
}

export type AccentColor = CardAccentColor;

export const ACCENT_MAP = withAccentAliases<AccentConfig>({
  primary: {
    stripe: getCardStripeClass("primary"),
    iconBg: SEMANTIC_BG.primary,
    iconText: SEMANTIC_TEXT.primary,
    ring: "ring-primary/20",
  },
  success: {
    stripe: getCardStripeClass("success"),
    iconBg: SEMANTIC_BG.success,
    iconText: SEMANTIC_TEXT.success,
    ring: "ring-success/20",
  },
  warning: {
    stripe: getCardStripeClass("warning"),
    iconBg: SEMANTIC_BG.warning,
    iconText: SEMANTIC_TEXT.warning,
    ring: "ring-warning/20",
  },
  destructive: {
    stripe: getCardStripeClass("destructive"),
    iconBg: SEMANTIC_BG.destructive,
    iconText: SEMANTIC_TEXT.destructive,
    ring: "ring-destructive/20",
  },
  info: {
    stripe: getCardStripeClass("info"),
    iconBg: SEMANTIC_BG.info,
    iconText: SEMANTIC_TEXT.info,
    ring: "ring-info/20",
  },
  secondary: {
    stripe: getCardStripeClass("secondary"),
    iconBg: SEMANTIC_BG.secondary,
    iconText: SEMANTIC_TEXT.secondary,
    ring: "ring-secondary/20",
  },
  muted: {
    stripe: getCardStripeClass("muted"),
    iconBg: SEMANTIC_BG.mutedSolid,
    iconText: SEMANTIC_TEXT.muted,
    ring: "ring-muted/20",
  },
});

/** Resolves legacy names and semantic tokens through the shared accent contract. */
export function resolveAccent(accent?: string | null): AccentConfig {
  return ACCENT_MAP[resolveAccentTone(accent)];
}

/** Semantic Tailwind tone classes — prefer these over raw palette utilities. */

export const SURFACE = {
  glass: "border border-foreground/12 bg-card shadow-surface-lg",
  card: "rounded-xl border border-border bg-card shadow-surface",
  elevated: "rounded-xl border border-border bg-card shadow-surface-lg",
  mutedHeader: "border-b border-border bg-muted/20",
} as const;

/** Logo / avatar image on themed backgrounds */
export const LOGO_IMAGE = "object-cover bg-card border border-border";

/** Toggle switch thumb — theme-aware (not raw white) */
export const TOGGLE_THUMB = "bg-card shadow-sm";

/** Selected wizard / radio inner dot */
export const WIZARD_SELECTION_DOT = "bg-primary-foreground";

/** Frosted chip on primary gradient banners */
export const BANNER_FROST_CHIP = "bg-primary-foreground/10 border border-primary-foreground/15";

export const SEMANTIC_BADGE = {
  primary: "bg-primary/10 text-primary border-primary/20",
  primaryStrong: "bg-primary/15 text-primary border-primary/30",
  success: "bg-success/10 text-success border-success/20",
  successStrong: "bg-success/15 text-success border-success/30",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  destructiveStrong: "bg-destructive/15 text-destructive border-destructive/30",
  destructiveSolid: "bg-destructive text-destructive-foreground border-destructive",
  warning: "bg-warning/10 text-warning border-warning/20",
  warningStrong: "bg-warning/15 text-warning border-warning/30",
  info: "bg-info/10 text-info border-info/20",
  infoStrong: "bg-info/15 text-info border-info/30",
  secondary: "bg-secondary/10 text-secondary border-secondary/20",
  muted: "bg-muted text-muted-foreground border-border",
} as const;

export const SEMANTIC_TEXT = {
  primary: "text-primary",
  success: "text-success",
  destructive: "text-destructive",
  warning: "text-warning",
  info: "text-info",
  secondary: "text-secondary",
  muted: "text-muted-foreground",
} as const;

export const SEMANTIC_BG = {
  primary: "bg-primary/10",
  primarySolid: "bg-primary",
  success: "bg-success/10",
  successSolid: "bg-success",
  destructive: "bg-destructive/10",
  destructiveSolid: "bg-destructive",
  warning: "bg-warning/10",
  warningSolid: "bg-warning",
  info: "bg-info/10",
  infoSolid: "bg-info",
  secondary: "bg-secondary/10",
  secondarySolid: "bg-secondary",
  muted: "bg-muted/10",
  mutedSolid: "bg-muted",
} as const;

export function getSolidBgClass(tone: string): string {
  const key = `${tone}Solid` as keyof typeof SEMANTIC_BG;
  return SEMANTIC_BG[key] ?? SEMANTIC_BG.primarySolid;
}

export const HOVER_BORDER_TONE = {
  primary: "hover:border-primary/50",
  success: "hover:border-success/50",
  warning: "hover:border-warning/50",
  destructive: "hover:border-destructive/50",
  info: "hover:border-info/50",
  secondary: "hover:border-secondary/50",
  muted: "hover:border-border",
} as const;

export {
  AVATAR_GRADIENTS,
  AVATAR_GRADIENT_ROTATION,
  genderSelectClass,
  genderBadgeClass,
  genderAvatarGradient,
} from "./avatarThemeTokens";

/** Capacity / progress bar fill by percentage. */
export function progressBarClass(pct: number, thresholds = { warn: 80, danger: 100 }): string {
  if (pct >= thresholds.danger) return "bg-destructive";
  if (pct >= thresholds.warn) return "bg-warning";
  return "bg-success";
}

/** Attendance or completion rate text + bar colours. */
export function rateToneClass(
  rate: number,
  thresholds = { good: 90, ok: 75 },
): { text: string; bar: string } {
  if (rate >= thresholds.good) return { text: "text-success", bar: "bg-success" };
  if (rate >= thresholds.ok) return { text: "text-warning", bar: "bg-warning" };
  return { text: "text-destructive", bar: "bg-destructive" };
}

/** Signed delta for KPI trends. */
export function trendTextClass(delta: number): string {
  if (delta > 0) return "text-success";
  if (delta < 0) return "text-destructive";
  return "text-muted-foreground";
}

/** Payment method chips (finance module). */
export const PAYMENT_METHOD_BADGE: Record<string, string> = {
  Cash: SEMANTIC_BADGE.success,
  "Bank Transfer": SEMANTIC_BADGE.info,
  Online: SEMANTIC_BADGE.primary,
  Cheque: SEMANTIC_BADGE.warning,
  Other: SEMANTIC_BADGE.muted,
};

/** Money-in / money-out summary surfaces (cashbook, accounting). */
export const FLOW_TONE = {
  in: {
    border: "border-success/30",
    bg: "bg-success/10",
    text: "text-success",
    badge: SEMANTIC_BADGE.successStrong,
  },
  out: {
    border: "border-destructive/30",
    bg: "bg-destructive/10",
    text: "text-destructive",
    badge: SEMANTIC_BADGE.destructiveStrong,
  },
} as const;

/** KPI stat card shell — icon tint + surface. */
export const KPI_TONE = {
  success: { text: "text-success", bg: "bg-success/10", border: "border-success/20" },
  warning: { text: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
  destructive: {
    text: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
  },
  primary: { text: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
  info: { text: "text-info", bg: "bg-info/10", border: "border-info/20" },
} as const;

/** Obligation / wakala type chips */
export const OBLIGATION_TYPE_BADGE: Record<string, string> = {
  Syed: SEMANTIC_BADGE.primaryStrong,
  "Non-Syed": SEMANTIC_BADGE.infoStrong,
  Both: SEMANTIC_BADGE.success,
  None: SEMANTIC_BADGE.muted,
  Income: SEMANTIC_BADGE.success,
  Liability: SEMANTIC_BADGE.destructive,
};

export {
  CARD_STRIPE_WIDTH,
  CARD_STRIPE_INSET,
  CARD_STRIPE_BASE,
  CARD_STRIPE_COLORS,
  type CardAccentColor,
  getCardStripeClass,
} from "./cardAccentTokens";

/** Grade badge class mapping by grade tone. */
export function gradeBadgeClass(tone: string = "primary"): string {
  switch (tone) {
    case "success":
      return SEMANTIC_BADGE.success;
    case "info":
      return SEMANTIC_BADGE.info;
    case "warning":
      return SEMANTIC_BADGE.warning;
    case "secondary":
      return SEMANTIC_BADGE.secondary;
    case "destructive":
      return SEMANTIC_BADGE.destructive;
    case "primary":
    default:
      return SEMANTIC_BADGE.primary;
  }
}

/** Double-entry balance status tone styling (TrialBalance, Journals, Financials). */
export const BALANCE_TONE = {
  balanced: "bg-success/10 text-success border-success/30",
  unbalanced: "bg-destructive/10 text-destructive border-destructive/30",
} as const;

export function balanceToneClass(isBalanced: boolean): string {
  return isBalanced ? BALANCE_TONE.balanced : BALANCE_TONE.unbalanced;
}

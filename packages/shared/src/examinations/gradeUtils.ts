export type GradeTone = "success" | "info" | "primary" | "warning" | "secondary" | "destructive";

export interface GradeInfo {
  label: string;
  color: string;
  bg: string;
  border: string;
  tone?: GradeTone;
}

/**
 * Letter-grade bands, highest first.
 *
 * Exported because every surface must agree on the thresholds: the scoring engine, the analytics
 * grade distribution, imports and the printed card. They were previously inline literals in
 * `getGrade`, so any new aggregate had to re-encode 90/80/70/60/50 and could drift.
 */
/** Every letter grade the scale can emit, highest first (the enum used by DTOs). */
export const GRADE_LABELS = ["A+", "A", "B", "C", "D", "F"] as const;
export type GradeLabel = (typeof GRADE_LABELS)[number];

export const GRADE_BANDS = [
  { label: "A+", minPct: 90, tone: "success" },
  { label: "A", minPct: 80, tone: "info" },
  { label: "B", minPct: 70, tone: "primary" },
  { label: "C", minPct: 60, tone: "warning" },
  { label: "D", minPct: 50, tone: "secondary" },
  { label: "F", minPct: 0, tone: "destructive" },
] as const satisfies ReadonlyArray<{ label: GradeLabel; minPct: number; tone: GradeTone }>;

/** Lowest band (the fallback for any percentage, including a failed score). */
export const LOWEST_GRADE_BAND = GRADE_BANDS[GRADE_BANDS.length - 1]!;

function bandInfo(label: GradeLabel, tone: GradeTone): GradeInfo {
  return {
    label,
    tone,
    color: `hsl(var(--${tone}))`,
    bg: `hsl(var(--${tone}) / 0.1)`,
    border: `hsl(var(--${tone}) / 0.2)`,
  };
}

/**
 * Resolves score percentage to appropriate Grade metadata (label, semantic colors).
 */
export function getGrade(pct: number): GradeInfo {
  const band = GRADE_BANDS.find((entry) => pct >= entry.minPct) ?? LOWEST_GRADE_BAND;
  return bandInfo(band.label, band.tone);
}

/**
 * Returns rank format string with correct ordinal suffix (e.g. 1st, 2nd, 3rd, 4th).
 */
export function getRankSuffix(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const ordinalRemainder = n % 100;
  const suffix =
    suffixes[(ordinalRemainder - 20) % 10] || suffixes[ordinalRemainder] || suffixes[0];
  return n + suffix;
}

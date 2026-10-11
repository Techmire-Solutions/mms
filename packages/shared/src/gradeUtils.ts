export type GradeTone = "success" | "info" | "primary" | "warning" | "secondary" | "destructive";

export interface GradeInfo {
  label: string;
  color: string;
  bg: string;
  border: string;
  tone?: GradeTone;
}

/**
 * Resolves score percentage to appropriate Grade metadata (label, semantic colors).
 */
export function getGrade(pct: number): GradeInfo {
  if (pct >= 90)
    return {
      label: "A+",
      tone: "success",
      color: "hsl(var(--success))",
      bg: "hsl(var(--success) / 0.1)",
      border: "hsl(var(--success) / 0.2)",
    };
  if (pct >= 80)
    return {
      label: "A",
      tone: "info",
      color: "hsl(var(--info))",
      bg: "hsl(var(--info) / 0.1)",
      border: "hsl(var(--info) / 0.2)",
    };
  if (pct >= 70)
    return {
      label: "B",
      tone: "primary",
      color: "hsl(var(--primary))",
      bg: "hsl(var(--primary) / 0.1)",
      border: "hsl(var(--primary) / 0.2)",
    };
  if (pct >= 60)
    return {
      label: "C",
      tone: "warning",
      color: "hsl(var(--warning))",
      bg: "hsl(var(--warning) / 0.1)",
      border: "hsl(var(--warning) / 0.2)",
    };
  if (pct >= 50)
    return {
      label: "D",
      tone: "secondary",
      color: "hsl(var(--secondary))",
      bg: "hsl(var(--secondary) / 0.1)",
      border: "hsl(var(--secondary) / 0.2)",
    };
  return {
    label: "F",
    tone: "destructive",
    color: "hsl(var(--destructive))",
    bg: "hsl(var(--destructive) / 0.1)",
    border: "hsl(var(--destructive) / 0.2)",
  };
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

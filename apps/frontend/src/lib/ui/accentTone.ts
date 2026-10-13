export type AccentTone =
  "primary" | "success" | "warning" | "destructive" | "info" | "secondary" | "muted";

export const ACCENT_ALIASES = {
  neutral: "primary",
  pink: "primary",
  green: "success",
  emerald: "success",
  amber: "warning",
  red: "destructive",
  rose: "destructive",
  blue: "info",
  indigo: "info",
  teal: "info",
  violet: "primary",
  purple: "secondary",
} as const satisfies Record<string, AccentTone>;

export type AccentName = AccentTone | keyof typeof ACCENT_ALIASES;

const LEGACY_TONE_ORDER: readonly AccentTone[] = [
  "success",
  "destructive",
  "warning",
  "info",
  "secondary",
  "primary",
];

export function resolveAccentTone(accent?: string | null): AccentTone {
  if (!accent) return "primary";
  const normalized = accent.toLowerCase();
  // Keep support for legacy utility strings such as "text-emerald-600".
  for (const tone of LEGACY_TONE_ORDER) {
    if (
      normalized.includes(tone) ||
      Object.entries(ACCENT_ALIASES).some(
        ([alias, target]) => target === tone && normalized.includes(alias),
      )
    )
      return tone;
  }
  return normalized === "muted" ? "muted" : "primary";
}

export function withAccentAliases<T>(tones: Record<AccentTone, T>): Record<string, T> {
  return {
    ...tones,
    ...Object.fromEntries(
      Object.entries(ACCENT_ALIASES).map(([alias, tone]) => [alias, tones[tone]]),
    ),
  };
}

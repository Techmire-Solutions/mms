import { Mars, Venus, UserRound, type LucideIcon } from "lucide-react";
import { getAvatarColor } from "@mms/shared";

/** Canonical gender keys used for icons/tones across the app. */
export type GenderUiKey = "male" | "female" | "other" | "unspecified";

/** Type guard checking if a string is a canonical GenderUiKey. */
export function isGenderUiKey(value: unknown): value is GenderUiKey {
  return value === "male" || value === "female" || value === "other" || value === "unspecified";
}

/** Semantic badge tone for gender. */
export type GenderBadgeTone = "info" | "secondary" | "primary";

/**
 * Normalizes free-form gender strings (Male/FEMALE/custom) to a UI key.
 * Empty/unknown → empty string (callers treat as no gender).
 */
export function normalizeGenderKey(gender: string | null | undefined): GenderUiKey | "" {
  const raw = gender?.trim().toLowerCase() ?? "";
  if (!raw) return "";
  if (raw === "male" || raw === "m") return "male";
  if (raw === "female" || raw === "f") return "female";
  if (raw === "other") return "other";
  if (raw === "unspecified" || raw === "unknown" || raw === "any") return "unspecified";
  return "other";
}

/** Lucide icon for a gender value — Mars (male) / Venus (female) / UserRound (other/empty). */
export function getGenderIcon(gender: string | null | undefined): LucideIcon {
  switch (normalizeGenderKey(gender)) {
    case "male":
      return Mars;
    case "female":
      return Venus;
    default:
      return UserRound;
  }
}

/** Semantic text colour for gender icons and labels (pairs with gender badge tones). */
export function getGenderIconClass(gender: string | null | undefined): string {
  switch (normalizeGenderKey(gender)) {
    case "male":
      return "text-info";
    case "female":
      return "text-secondary";
    default:
      return "text-muted-foreground";
  }
}

/** Semantic text color class for gender names/labels. */
export function getGenderTextClass(gender: string | null | undefined): string {
  return getGenderIconClass(gender);
}

/** Semantic badge tone for gender. */
export function getGenderBadgeTone(gender?: string | null | undefined): GenderBadgeTone {
  switch (normalizeGenderKey(gender)) {
    case "male":
      return "info";
    case "female":
      return "secondary";
    default:
      return "primary";
  }
}

/** Full badge style classes for gender chips (background + text + border). */
export function getGenderBadgeClass(gender: string | null | undefined): string {
  switch (normalizeGenderKey(gender)) {
    case "male":
      return "bg-info/10 text-info border-info/25 dark:bg-info/15 dark:border-info/35";
    case "female":
      return "bg-secondary/15 text-secondary border-secondary/25 dark:bg-secondary/15 dark:border-secondary/35";
    default:
      return "bg-muted text-muted-foreground border-border/40";
  }
}

/** Subtle background tint for gender-aware cards or sections. */
export function getGenderBgClass(gender: string | null | undefined): string {
  switch (normalizeGenderKey(gender)) {
    case "male":
      return "bg-info/10";
    case "female":
      return "bg-secondary/10";
    default:
      return "bg-muted/40";
  }
}

/** Border color for gender-aware cards or sections. */
export function getGenderBorderClass(gender: string | null | undefined): string {
  switch (normalizeGenderKey(gender)) {
    case "male":
      return "border-info/30";
    case "female":
      return "border-secondary/30";
    default:
      return "border-border/40";
  }
}

/** Avatar fallback classes: applies centralized male/female theme color or deterministic ID fallback. */
export function getGenderAvatarFallbackClass(
  gender?: string | null | undefined,
  id?: string | number | null,
): string {
  switch (normalizeGenderKey(gender)) {
    case "male":
      return "bg-info/15 text-info ring-1 ring-info/30";
    case "female":
      return "bg-secondary/15 text-secondary ring-1 ring-secondary/35";
    default:
      return id ? getAvatarColor(id) : "bg-primary/15 text-primary";
  }
}

/** Shared gender accent bar class for Work directory entity cards. */
export function getGenderAccentBarClass(
  isSelected: boolean,
  gender?: string | null | undefined,
): string {
  if (isSelected) return "bg-primary/70 group-hover:bg-primary";
  switch (normalizeGenderKey(gender)) {
    case "male":
      return "bg-info/50 group-hover:bg-info";
    case "female":
      return "bg-secondary/50 group-hover:bg-secondary";
    default:
      return "bg-muted-foreground/35 group-hover:bg-muted-foreground/60";
  }
}

/** Card accent tone based on gender. */
export function getGenderCardAccent(gender?: string | null | undefined): GenderBadgeTone {
  return getGenderBadgeTone(gender);
}

/** Comprehensive theme configuration for a given gender value. */
export function getGenderThemeConfig(gender?: string | null | undefined) {
  const key = normalizeGenderKey(gender);
  return {
    key,
    icon: getGenderIcon(gender),
    iconClass: getGenderIconClass(gender),
    textClass: getGenderTextClass(gender),
    tone: getGenderBadgeTone(gender),
    badgeClass: getGenderBadgeClass(gender),
    bgClass: getGenderBgClass(gender),
    borderClass: getGenderBorderClass(gender),
  };
}

import { SEMANTIC_BADGE } from "./semanticTone";

export const AVATAR_GRADIENTS = {
  male: "from-info to-primary",
  female: "from-secondary to-primary",
  neutral: "from-primary to-info",
} as const;

export const AVATAR_GRADIENT_ROTATION = [
  "from-info to-primary",
  "from-secondary to-primary",
  "from-primary to-success",
  "from-warning to-primary",
] as const;

const GENDER_SELECT_IDLE = "border-border bg-card text-muted-foreground hover:bg-muted";

/** Gender pill selected/unselected classes — theme tokens only (Tailwind v4). */
export function genderSelectClass(gender: string, isSelected: boolean): string {
  if (!isSelected) return GENDER_SELECT_IDLE;
  const g = gender.toLowerCase();
  if (g === "male") {
    return "border-info text-info bg-info/10 ring-2 ring-info/10";
  }
  if (g === "female") {
    return "border-secondary text-secondary bg-secondary/10 ring-2 ring-secondary/10";
  }
  return "border-primary text-primary bg-primary/10 ring-2 ring-primary/10";
}

/** Gender badge chip — theme tokens only. */
export function genderBadgeClass(gender: string): string {
  const g = gender?.toLowerCase();
  if (g === "male") return SEMANTIC_BADGE.info;
  if (g === "female") return SEMANTIC_BADGE.secondary;
  return SEMANTIC_BADGE.infoStrong;
}

/** Avatar gradient by gender — theme tokens only. */
export function genderAvatarGradient(gender: string): string {
  const g = gender?.toLowerCase();
  if (g === "male") return AVATAR_GRADIENTS.male;
  if (g === "female") return AVATAR_GRADIENTS.female;
  return AVATAR_GRADIENTS.neutral;
}

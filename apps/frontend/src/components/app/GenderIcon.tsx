import type { LucideProps } from "lucide-react";
import { Mars, UserRound, Venus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGenderIconClass, normalizeGenderKey } from "@/lib/ui/genderUi";

export interface GenderIconProps extends Omit<LucideProps, "ref"> {
  gender?: string | null;
}

/** Static icon map — never resolve component references through a render-time call. */
const GENDER_ICONS = {
  male: Mars,
  female: Venus,
} as const;

/**
 * Shared gender glyph — Mars (male) / Venus (female) / UserRound (other/unspecified).
 * Use everywhere gender is shown with an icon.
 */
export function GenderIcon({ gender, className, ...props }: GenderIconProps): React.JSX.Element {
  const key = normalizeGenderKey(gender);
  const Icon = GENDER_ICONS[key as keyof typeof GENDER_ICONS] ?? UserRound;
  return <Icon className={cn(getGenderIconClass(gender), className)} aria-hidden {...props} />;
}

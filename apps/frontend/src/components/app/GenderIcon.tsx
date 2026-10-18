import type { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGenderIcon, getGenderIconClass } from "@/lib/ui/genderUi";

export interface GenderIconProps extends Omit<LucideProps, "ref"> {
  gender?: string | null;
}

/**
 * Shared gender glyph — Mars (male) / Venus (female) / UserRound (other/unspecified).
 * Use everywhere gender is shown with an icon.
 */
export function GenderIcon({ gender, className, ...props }: GenderIconProps): React.JSX.Element {
  const Icon = getGenderIcon(gender);
  return <Icon className={cn(getGenderIconClass(gender), className)} aria-hidden {...props} />;
}

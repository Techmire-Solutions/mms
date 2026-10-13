import type { ReactNode } from "react";
import { UserAvatar } from "@/components/app/UserAvatar";
import { BiDiText } from "@/components/app/BiDiText";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CARD_STRIPE_INSET, type CardAccentColor } from "@/lib/ui/semanticTone";
import { getGenderCardAccent } from "@/lib/ui/genderUi";

export interface PersonDetailHeroCardProps {
  id: string | number;
  displayName: string;
  avatar?: string | null;
  gender?: string | null;
  accentColor?: CardAccentColor | "none" | false | null;
  className?: string;
  /** Meta row (badges / identity chips) rendered under the title. */
  children?: ReactNode;
}

/**
 * Person detail hero shell shared by Contacts, Students, and Teachers.
 *
 * Renders the gradient card, avatar, and name title; modules supply their own
 * meta row (status/GR badges, identity chips) as children.
 */
export function PersonDetailHeroCard({
  id,
  displayName,
  avatar,
  gender,
  accentColor,
  className,
  children,
}: PersonDetailHeroCardProps): React.JSX.Element {
  const resolvedAccent = accentColor ?? (gender ? getGenderCardAccent(gender) : "primary");
  const hasStripe = resolvedAccent !== false && resolvedAccent !== "none";

  return (
    <Card
      accentColor={resolvedAccent}
      className={cn(
        "flex items-center gap-4 p-4 bg-gradient-to-br from-card via-card to-muted/40 shadow-xs",
        hasStripe && CARD_STRIPE_INSET,
        className,
      )}
    >
      <UserAvatar
        id={id}
        name={displayName}
        avatar={avatar}
        gender={gender}
        className="w-16 h-16 rounded-2xl text-2xl font-bold flex-shrink-0 shadow-xs"
      />
      <div className="flex-1 min-w-0">
        <BiDiText
          as="h3"
          className="text-base font-bold text-foreground truncate leading-tight"
          titleFromContent
        >
          {displayName}
        </BiDiText>
        {children ? (
          <div className="flex flex-wrap gap-1.5 mt-2 items-center">{children}</div>
        ) : null}
      </div>
    </Card>
  );
}

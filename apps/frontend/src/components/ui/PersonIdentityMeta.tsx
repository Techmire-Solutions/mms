import React, { type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { GenderIcon } from "@/components/ui/GenderIcon";
import { formatContactGenderLabel } from "@/lib/contacts/contactI18n";
import { getGenderBadgeTone } from "@/lib/genderUi";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

export interface PersonIdentityMetaProps {
  gender?: string | null;
  /** When true, shows the Syed badge. Uses `syedLabel` or defaults to localized "Syed". */
  isSyed?: boolean | null;
  syedLabel?: string;
  className?: string;
  /** Compact chip used in table/card name columns; md slightly larger for drawer hero. */
  size?: "sm" | "md";
  /** Whether to use pill (capsule) curvature or theme radius. Default: false. */
  pill?: boolean;
  /** Additional custom badges to flow inline (e.g. GR badge, blood group, tags). */
  extraBadges?: ReactNode;
  /** Children to append to the badge list. */
  children?: ReactNode;
  /** Optional click handler to filter by gender. */
  onGenderClick?: () => void;
  /** Optional click handler to filter by Syed status. */
  onSyedClick?: () => void;
}

/** Gender (+ optional Syed) identity row for person directory cards/tables/detail. */
export const PersonIdentityMeta = function PersonIdentityMeta({
  gender,
  isSyed,
  syedLabel,
  className,
  size = "sm",
  pill = false,
  extraBadges,
  children,
  onGenderClick,
  onSyedClick,
}: PersonIdentityMetaProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const normalizedGender = gender?.trim().toLowerCase();
  const hasGender =
    Boolean(normalizedGender) && normalizedGender !== "unspecified" && normalizedGender !== "none";
  const showSyed = Boolean(isSyed);
  const effectiveSyedLabel = syedLabel || t("contacts.table.yesSyed");

  if (!hasGender && !showSyed && !extraBadges && !children) return null;

  const iconSize = size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";
  const badgePadding = size === "md" ? "px-2.5 py-0.5" : "px-2 py-0.5";

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap leading-normal", className)}>
      {hasGender ? (
        <Badge
          as={onGenderClick ? "button" : "span"}
          type={onGenderClick ? "button" : undefined}
          pill={pill}
          onClick={onGenderClick}
          tone={getGenderBadgeTone(gender)}
          className={cn(
            "gap-1 text-xs font-semibold capitalize",
            badgePadding,
            onGenderClick && "cursor-pointer hover:opacity-80 transition-opacity",
          )}
        >
          <GenderIcon gender={gender} className={cn(iconSize, "inline shrink-0")} />
          <span>{formatContactGenderLabel(normalizedGender!, t)}</span>
        </Badge>
      ) : null}

      {showSyed ? (
        <Badge
          as={onSyedClick ? "button" : "span"}
          type={onSyedClick ? "button" : undefined}
          pill={pill}
          onClick={onSyedClick}
          tone="success"
          className={cn(
            "gap-1 text-xs font-semibold",
            badgePadding,
            onSyedClick && "cursor-pointer hover:opacity-80 transition-opacity",
          )}
        >
          <CheckCircle2 className={cn(iconSize, "text-success inline shrink-0")} aria-hidden />
          <span>{effectiveSyedLabel}</span>
        </Badge>
      ) : null}

      {extraBadges}
      {children}
    </div>
  );
};

/** Optional wrapper when subtitle stacks multiple identity rows (e.g. GR + gender). */
export const DirectoryCardSubtitleStack = function DirectoryCardSubtitleStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  return <div className={cn("mt-0.5 flex flex-col gap-0.5 min-w-0", className)}>{children}</div>;
};

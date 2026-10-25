import React from "react";
import type { ReactNode } from "react";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BiDiText } from "@/components/app/BiDiText";
import { cn } from "@/lib/utils";

export interface EntityCardHeaderProps {
  id: string | number;
  displayName: string;
  avatar?: string | null;
  gender?: string | null;
  isSelected: boolean;
  onSelect: () => void;
  selectAriaLabel: string;
  /** When absent, the avatar + title block renders as plain content (no dead button). */
  onView?: () => void;
  viewAriaLabel?: string;
  subtitle?: ReactNode;
  showSelect?: boolean;
  reducedMotion?: boolean;
  className?: string;
}

/** Shared Work directory card header: checkbox | avatar + title + subtitle. */
export const DirectoryCardHeader = function DirectoryCardHeader({
  id,
  displayName,
  avatar,
  gender,
  isSelected,
  onSelect,
  selectAriaLabel,
  onView,
  viewAriaLabel,
  subtitle,
  showSelect = true,
  reducedMotion = false,
  className,
}: EntityCardHeaderProps): React.JSX.Element {
  const face = (
    <>
      <UserAvatar
        id={id}
        name={displayName}
        avatar={avatar ?? undefined}
        gender={gender}
        className={cn(
          "w-11 h-11 rounded-2xl text-sm shadow-inner shrink-0",
          !reducedMotion && "group-hover:scale-105 transition-transform duration-200",
        )}
      />
      <div className="min-w-0 flex-1">
        <BiDiText
          as="h4"
          className="text-sm font-black text-foreground tracking-tight text-wrap break-words group-hover:text-primary transition-colors"
          titleFromContent
        >
          {displayName}
        </BiDiText>
        {subtitle}
      </div>
    </>
  );

  return (
    <div className={cn("flex gap-3 items-start", className)}>
      {showSelect ? (
        <div className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center">
          <Checkbox checked={isSelected} onCheckedChange={onSelect} aria-label={selectAriaLabel} />
        </div>
      ) : null}
      {onView && viewAriaLabel ? (
        <Button
          type="button"
          variant="ghost"
          className="h-auto p-0 hover:bg-transparent flex flex-1 items-start gap-2.5 min-w-0 text-start cursor-pointer hover:text-foreground shadow-none justify-start"
          onClick={onView}
          aria-label={viewAriaLabel}
        >
          {face}
        </Button>
      ) : (
        <div className="flex flex-1 items-start gap-2.5 min-w-0 text-start">{face}</div>
      )}
    </div>
  );
};
